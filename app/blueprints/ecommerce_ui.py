from flask import Blueprint, render_template, request, jsonify, session, current_app
from app.models import db, Product, Category, Attribute, ProductAttributeValue, ProductImage, Sale, SaleItem, StockMovement # Added Sale, SaleItem, StockMovement
import decimal # For precise monetary calculations

ecommerce_bp = Blueprint('ecommerce_bp', __name__, template_folder='../../templates/ecommerce', url_prefix='/shop')

# --- Cart Helper Functions ---

def get_cart():
    """Retrieves the cart from session, initializes if not present."""
    # Structure: cart = {'product_id_1': quantity, 'product_id_2': quantity}
    cart = session.get('cart', {})
    # Ensure quantities are integers
    for product_id, quantity in cart.items():
        try:
            cart[product_id] = int(quantity)
        except ValueError:
            # Handle or log error, remove invalid item
            current_app.logger.warn(f"Invalid quantity for product_id {product_id} in cart, removing.")
            del cart[product_id] # Or set to a default like 1
    session['cart'] = cart # Ensure session is updated if items were cleaned
    return cart

def add_to_cart(product_id, quantity_to_add=1):
    """Adds a product to the cart or updates its quantity."""
    cart = get_cart()
    product_id_str = str(product_id) # Ensure product_id is string for session keys
    quantity_to_add = int(quantity_to_add)

    if quantity_to_add <= 0:
        return # Or raise error, or set to 1

    current_quantity = cart.get(product_id_str, 0)
    cart[product_id_str] = current_quantity + quantity_to_add
    session['cart'] = cart
    session.modified = True

def update_cart_item(product_id, new_quantity):
    """Updates the quantity of an item in the cart. Removes if quantity is 0 or less."""
    cart = get_cart()
    product_id_str = str(product_id)
    new_quantity = int(new_quantity)

    if new_quantity <= 0:
        if product_id_str in cart:
            del cart[product_id_str]
    else:
        cart[product_id_str] = new_quantity
    session['cart'] = cart
    session.modified = True

def remove_from_cart(product_id):
    """Removes an item from the cart."""
    cart = get_cart()
    product_id_str = str(product_id)
    if product_id_str in cart:
        del cart[product_id_str]
        session['cart'] = cart
        session.modified = True

def clear_cart():
    """Clears all items from the cart."""
    session.pop('cart', None)
    session.modified = True

def get_cart_item_count():
    """Returns the total number of individual items in the cart (sum of quantities)."""
    cart = get_cart()
    return sum(cart.values())

def get_cart_details():
    """
    Retrieves detailed information for each item in the cart (product details, subtotal)
    and calculates cart totals.
    """
    cart_session_items = get_cart()
    detailed_items = []
    cart_total_amount = decimal.Decimal('0.00')

    if not cart_session_items:
        return {
            'items': [], 
            'total_items_count': 0, 
            'cart_total_amount': '0.00'
        }

    product_ids = [int(pid) for pid in cart_session_items.keys()]
    products_in_cart = Product.query.filter(Product.id.in_(product_ids)).all()
    products_map = {str(p.id): p for p in products_in_cart}

    for product_id_str, quantity in cart_session_items.items():
        product = products_map.get(product_id_str)
        if product:
            price = decimal.Decimal(str(product.price)) # Ensure price is Decimal
            subtotal = price * decimal.Decimal(quantity)
            cart_total_amount += subtotal
            
            default_image = product.images.filter_by(is_default=True).first()
            image_url = (default_image.image_url if default_image 
                         else (product.images.first().image_url if product.images.first() else None))

            detailed_items.append({
                'product_id': product.id,
                'name': product.name,
                'sku': product.sku,
                'quantity': quantity,
                'price': str(price.quantize(decimal.Decimal('0.01'))), # Format to 2 decimal places
                'subtotal': str(subtotal.quantize(decimal.Decimal('0.01'))),
                'image_url': image_url
            })
        else:
            # Product not found in DB, remove from cart (stale data)
            current_app.logger.warn(f"Product ID {product_id_str} found in cart but not in DB. Removing from cart.")
            remove_from_cart(product_id_str) # This modifies session directly

    return {
        'items': detailed_items,
        'total_items_count': sum(item['quantity'] for item in detailed_items), # Re-sum quantities from validated items
        'cart_total_amount': str(cart_total_amount.quantize(decimal.Decimal('0.01')))
    }

# --- End Cart Helper Functions ---

@ecommerce_bp.route('/')
@ecommerce_bp.route('/products')
def product_list():
    """Displays a list of products for the ecommerce store."""
    products = Product.query.options(
        db.joinedload(Product.category),
        db.joinedload(Product.images) # Eager load default image or all images
    ).order_by(Product.name).all()
    # TODO: Add pagination later
    return render_template('product_list.html', products=products, title="Products")

@ecommerce_bp.route('/products/<int:product_id>')
def product_detail(product_id):
    """Displays the details for a specific product."""
    product = Product.query.options(
        db.joinedload(Product.category),
        db.joinedload(Product.images), # Eager load all images for detail view
        db.joinedload(Product.attributes).joinedload(ProductAttributeValue.attribute) # Eager load attributes and their types
    ).get_or_404(product_id)
    return render_template('product_detail.html', product=product, title=product.name)

# --- Cart API Endpoints ---

@ecommerce_bp.route('/api/cart/add', methods=['POST'])
def api_add_to_cart():
    data = request.get_json()
    if not data or 'product_id' not in data or 'quantity' not in data:
        return jsonify({'success': False, 'message': 'Missing product_id or quantity.'}), 400

    try:
        product_id = int(data['product_id'])
        quantity = int(data['quantity'])
    except ValueError:
        return jsonify({'success': False, 'message': 'Invalid product_id or quantity format.'}), 400

    if quantity <= 0:
        return jsonify({'success': False, 'message': 'Quantity must be positive.'}), 400

    product = Product.query.get(product_id)
    if not product:
        return jsonify({'success': False, 'message': 'Product not found.'}), 404

    # Basic stock check (placeholder - real stock management is complex)
    # if product.stock < quantity: # Assuming a 'stock' field on Product model
    #     return jsonify({'success': False, 'message': 'Not enough stock.'}), 400
    
    add_to_cart(product_id, quantity)
    
    return jsonify({
        'success': True, 
        'message': f'{product.name} added to cart.',
        'cart_item_count': get_cart_item_count() # Total number of items in cart
    }), 200


@ecommerce_bp.route('/api/cart/data', methods=['GET'])
def api_get_cart_data():
    cart_details = get_cart_details()
    return jsonify(cart_details), 200

# --- Cart View Page ---

@ecommerce_bp.route('/cart')
def view_cart():
    """Displays the shopping cart page."""
    cart_details = get_cart_details()
    return render_template('cart_view.html', cart=cart_details, title="Your Shopping Cart")

# --- Cart Modification API Endpoints ---

@ecommerce_bp.route('/api/cart/update/<int:product_id>', methods=['POST'])
def api_update_cart_item(product_id):
    data = request.get_json()
    if not data or 'quantity' not in data:
        return jsonify({'success': False, 'message': 'Missing quantity.'}), 400

    try:
        quantity = int(data['quantity'])
    except ValueError:
        return jsonify({'success': False, 'message': 'Invalid quantity format.'}), 400

    # update_cart_item handles quantity <= 0 by removing the item
    update_cart_item(product_id, quantity)
    
    # After update, get the new state of the cart to return updated totals etc.
    cart_details = get_cart_details() 
    
    return jsonify({
        'success': True, 
        'message': 'Cart updated.',
        'cart_item_count': cart_details['total_items_count'],
        'cart_total_amount': cart_details['cart_total_amount'],
        'updated_item_id': product_id, # Optional: for specific UI updates
        'new_quantity_for_item': get_cart().get(str(product_id), 0) # Get the actual quantity after update
    }), 200


@ecommerce_bp.route('/api/cart/remove/<int:product_id>', methods=['POST']) # Changed to POST for consistency, though GET with side effects is common too
def api_remove_from_cart(product_id):
    remove_from_cart(product_id)
    
    cart_details = get_cart_details()

    return jsonify({
        'success': True, 
        'message': 'Item removed from cart.',
        'cart_item_count': cart_details['total_items_count'],
        'cart_total_amount': cart_details['cart_total_amount']
    }), 200

# --- Checkout Page ---

@ecommerce_bp.route('/checkout')
def checkout():
    """Displays the checkout page."""
    cart_details = get_cart_details()
    if not cart_details or not cart_details['items']:
        flash("Your cart is empty. Please add items before proceeding to checkout.", "warning")
        return redirect(url_for('ecommerce_bp.product_list')) # Or 'ecommerce_bp.view_cart'
    
    # For simplicity, we're not handling complex tax or shipping calculations here yet.
    # The final_amount from cart_details is what we'll use.
    return render_template('checkout.html', cart=cart_details, title="Checkout")

# --- Place Order API Endpoint ---

@ecommerce_bp.route('/api/checkout/place_order', methods=['POST'])
def api_place_order():
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'message': 'No data submitted.'}), 400

    cart_details = get_cart_details()
    if not cart_details or not cart_details['items']:
        return jsonify({'success': False, 'message': 'Your cart is empty.'}), 400

    # Basic validation for required fields (can be more extensive)
    required_fields = ['customer_email', 'shipping_address_line1', 'shipping_city', 'shipping_state', 'shipping_postal_code', 'shipping_country']
    missing_fields = [field for field in required_fields if not data.get(field)]
    if missing_fields:
        # If delivery method is IN_STORE_PICKUP, shipping fields are not required by form JS, so don't fail here for them.
        # Server-side validation needs to be aware of delivery_method.
        delivery_method = data.get('delivery_method', 'HOME_DELIVERY')
        if delivery_method == 'HOME_DELIVERY':
            # Check shipping fields only if it's home delivery
            final_missing_fields = [field for field in required_fields if not data.get(field)]
            if final_missing_fields:
                 return jsonify({'success': False, 'message': f"Missing required shipping fields: {', '.join(final_missing_fields)}"}), 400
        # If IN_STORE_PICKUP, we don't need to check these specific shipping fields further.

    try:
        # Create Sale record
        new_sale = Sale(
            customer_email=data.get('customer_email'),
            customer_phone=data.get('customer_phone'),
            order_status='PENDING_PAYMENT', # Default status
            delivery_method=data.get('delivery_method', 'HOME_DELIVERY') 
        )

        if new_sale.delivery_method == 'HOME_DELIVERY':
            new_sale.shipping_address_line1=data.get('shipping_address_line1')
            new_sale.shipping_address_line2=data.get('shipping_address_line2')
            new_sale.shipping_city=data.get('shipping_city')
            new_sale.shipping_state=data.get('shipping_state')
            new_sale.shipping_postal_code=data.get('shipping_postal_code')
            new_sale.shipping_country=data.get('shipping_country')
            new_sale.pickup_instructions = None # Ensure it's null for home delivery
        elif new_sale.delivery_method == 'IN_STORE_PICKUP':
            new_sale.pickup_instructions = data.get('pickup_instructions', 'Customer will pick up at store. Please await notification.')
            # Nullify shipping fields for pickup orders
            new_sale.shipping_address_line1 = None
            new_sale.shipping_address_line2 = None
            new_sale.shipping_city = None
            new_sale.shipping_state = None
            new_sale.shipping_postal_code = None
            new_sale.shipping_country = None
        
        db.session.add(new_sale)

        # Add SaleItems from cart
        current_total_amount = decimal.Decimal('0.00')
        for item_in_cart in cart_details['items']:
            product = Product.query.get(item_in_cart['product_id']) # Fetch product again to ensure it's still valid
            if not product:
                db.session.rollback()
                return jsonify({'success': False, 'message': f"Product '{item_in_cart['name']}' is no longer available."}), 400
            
            sale_item = SaleItem(
                product_id=product.id,
                quantity=item_in_cart['quantity'],
                price_at_sale=decimal.Decimal(item_in_cart['price']) # Use price from cart details (which was from product.price)
                # subtotal is auto-calculated in SaleItem.__init__
            )
            new_sale.items.append(sale_item)
            current_total_amount += decimal.Decimal(sale_item.subtotal)
        
        # Set amounts on the Sale object
        new_sale.total_amount = float(current_total_amount.quantize(decimal.Decimal('0.01')))
        # For now, no separate discount/tax at e-commerce checkout, but can be added
        new_sale.discount_amount = 0.0 
        new_sale.tax_amount = 0.0 # Or calculate if applicable
        new_sale.calculate_totals() # This will set final_amount

        # Update stock levels and create stock movements for each item sold
        for item in new_sale.items: # new_sale.items were populated from cart_details['items']
            product_sold = Product.query.get(item.product_id)
            if product_sold:
                new_qoh = product_sold.quantity_on_hand - item.quantity
                stock_move = StockMovement(
                    product_id=product_sold.id,
                    change_quantity=-item.quantity,
                    new_quantity_on_hand=new_qoh,
                    reason_code='SALE',
                    notes=f'E-commerce Order ID: {new_sale.id}',
                    related_sale_id=new_sale.id
                )
                db.session.add(stock_move)
                product_sold.quantity_on_hand = new_qoh
            else:
                current_app.logger.error(f"Product with ID {item.product_id} not found during stock update for E-commerce Order ID {new_sale.id}")


        db.session.commit()
        clear_cart() # Clear cart from session

        return jsonify({
            'success': True, 
            'message': 'Order placed successfully!', 
            'sale_id': new_sale.id,
            'order_status': new_sale.order_status,
            'final_amount': new_sale.final_amount
        }), 201

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error placing order: {str(e)}")
        return jsonify({'success': False, 'message': f'An unexpected error occurred: {str(e)}'}), 500

# --- Order Confirmation Page ---

@ecommerce_bp.route('/order_confirmation/<int:sale_id>')
def order_confirmation(sale_id):
    """Displays the order confirmation page for a given sale."""
    sale = Sale.query.options(
        db.joinedload(Sale.items).joinedload(SaleItem.product) # Eager load items and their products
    ).get_or_404(sale_id)

    # Basic check: if it's an e-commerce order, it should ideally have an email.
    # This is just a soft check; a more robust system might have an 'order_type' field.
    if not sale.customer_email:
        # This might be too strict if other sale types can end up here.
        # For now, assume e-commerce sales should have an email.
        flash("Order details could not be fully displayed (missing customer information).", "warning")
        # Or redirect to shop home if the order is clearly not an e-commerce one.
        # return redirect(url_for('ecommerce_bp.product_list'))
    
    return render_template('order_confirmation.html', sale=sale, title=f"Order Confirmation #{sale.id}")
