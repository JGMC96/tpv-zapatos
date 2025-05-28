from flask import Blueprint, render_template, request, jsonify, current_app
from app.models import db, Product, Sale, SaleItem, StockMovement # Import necessary models
# Potentially forms if using Flask-WTF, but for POS, JS interaction is more common

pos_bp = Blueprint('pos_bp', __name__, template_folder='../../templates/pos', url_prefix='/pos/ui')

@pos_bp.route('/')
def index():
    """Main POS interface."""
    # For now, just render the page. Products can be fetched via JS/API.
    return render_template('index.html', title="Point of Sale")

# Example API endpoint within POS blueprint (could also be in general API)
# This is just a placeholder to show how products might be fetched for the POS.
# The main PIM product API GET /products should be preferred and used by the frontend.
@pos_bp.route('/api/get_products_for_pos')
def get_products_for_pos():
    # This is a simplified example. In a real scenario, you'd have pagination,
    # more filtering, and potentially only send fields relevant to POS.
    # The main PIM product API GET /products is used by the frontend JS directly.
    # This endpoint is likely redundant if the main /products API is sufficient.
    products = Product.query.options(db.joinedload(Product.images)).order_by(Product.name).all()
    
    product_list = []
    for p in products:
        default_image_url = None
        if p.images:
            default_img = p.images.filter_by(is_default=True).first()
            if default_img:
                default_image_url = default_img.image_url
            elif p.images.first(): # Fallback to first image if no default
                default_image_url = p.images.first().image_url
        
        product_list.append({
            'id': p.id,
            'name': p.name,
            'sku': p.sku,
            'price': p.price,
            'description': p.description,
            'category_name': p.category.name if p.category else 'N/A',
            'image_url': default_image_url
        })
    return jsonify(product_list)

@pos_bp.route('/api/process_sale', methods=['POST'])
def process_sale_api():
    data = request.get_json()

    if not data or 'items' not in data or not data['items']:
        return jsonify({'message': 'No items provided for the sale.'}), 400

    try:
        new_sale = Sale(
            discount_amount=float(data.get('discount_amount', 0.0)),
            tax_amount=float(data.get('tax_amount', 0.0)),
            payment_type=data.get('payment_type', 'cash'),
            transaction_id=data.get('transaction_id')
        )
        db.session.add(new_sale)

        total_calculated_amount = 0
        
        for item_data in data['items']:
            product = Product.query.get(item_data.get('product_id'))
            if not product:
                db.session.rollback() # Rollback if any product is not found
                return jsonify({'message': f"Product with ID {item_data.get('product_id')} not found."}), 400
            
            quantity = int(item_data.get('quantity', 0))
            if quantity <= 0:
                db.session.rollback()
                return jsonify({'message': f"Invalid quantity for product {product.name}."}), 400

            price_at_sale = float(item_data.get('price_at_sale', product.price)) # Use provided price or current product price
            
            sale_item = SaleItem(
                # sale=new_sale, # Will be associated via backref or can be done manually
                product_id=product.id,
                quantity=quantity,
                price_at_sale=price_at_sale
                # subtotal is calculated in SaleItem's __init__
            )
            new_sale.items.append(sale_item) # Associate item with sale
            total_calculated_amount += sale_item.subtotal
        
        # Verify total_amount if sent from client, or recalculate
        new_sale.total_amount = round(total_calculated_amount, 2)
        new_sale.calculate_totals() # Recalculates total_amount and final_amount based on items, discount, tax

        # Update stock levels and create stock movements for each item sold in this sale
        for item in new_sale.items:
            product_sold = Product.query.get(item.product_id) # Get the product instance
            if product_sold:
                new_qoh = product_sold.quantity_on_hand - item.quantity
                # Create stock movement record
                stock_move = StockMovement(
                    product_id=product_sold.id,
                    change_quantity=-item.quantity, # Negative for sale
                    new_quantity_on_hand=new_qoh,
                    reason_code='SALE',
                    notes=f'Sale ID: {new_sale.id}', # Auto-generated note
                    related_sale_id=new_sale.id
                )
                db.session.add(stock_move)
                product_sold.quantity_on_hand = new_qoh # Update product's stock
            else:
                # This case should ideally not happen if product validation was done before
                current_app.logger.error(f"Product with ID {item.product_id} not found during stock update for Sale ID {new_sale.id}")


        db.session.commit()
        return jsonify({'message': 'Sale processed successfully.', 'sale_id': new_sale.id, 'final_amount': new_sale.final_amount}), 201

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'message': f'Invalid data format: {str(ve)}'}), 400
    except Exception as e:
        db.session.rollback()
        # Log the exception e for server-side review
        current_app.logger.error(f"Error processing sale: {str(e)}")
        return jsonify({'message': f'An unexpected error occurred: {str(e)}'}), 500

@pos_bp.route('/receipt/<int:sale_id>')
def view_receipt(sale_id):
    """Displays the receipt for a given sale."""
    sale = Sale.query.options(
        db.joinedload(Sale.items).joinedload(SaleItem.product) # Eager load items and their products
    ).get_or_404(sale_id)
    
    # You can add any other data needed for the receipt, e.g., shop details from config
    shop_details = {
        'name': 'My Awesome TPV Store',
        'address': '123 Main Street, Anytown, USA',
        'phone': '555-123-4567',
        'website': 'www.myawesometpv.com'
    }
    
    return render_template('receipt.html', sale=sale, shop_details=shop_details, title=f"Receipt for Sale #{sale.id}")
