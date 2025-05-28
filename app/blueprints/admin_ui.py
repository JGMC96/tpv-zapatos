from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.models import db, Sale, SaleItem, Product # Assuming direct DB access for admin views

admin_bp = Blueprint('admin_bp', __name__, template_folder='../../templates/admin', url_prefix='/admin')

@admin_bp.route('/')
def index():
    """Admin dashboard/index page."""
    # For now, redirect to order list, or show some stats later
    return redirect(url_for('admin_bp.list_orders'))

# Placeholder for order status options, can be moved to config or model
ORDER_STATUS_CHOICES = [
    'PENDING_PAYMENT',          # Customer started checkout, but payment not yet confirmed.
    'PROCESSING',               # Payment confirmed, order is being processed (could be alias for AWAITING_PICKING).
    'AWAITING_PICKING',         # Order confirmed, items need to be picked from stock.
    'PICKING_IN_PROGRESS',      # Someone is currently picking the items.
    'PICKED',                   # All items for the order have been picked.
    'PACKED',                   # Order is packed and ready for dispatch or pickup.
    'SHIPPED',                  # Order has been handed over to the courier (for home delivery).
    'READY_FOR_PICKUP',         # Order is ready for customer pickup (for in-store pickup).
    'DELIVERED',                # Order has been successfully delivered to the customer.
    'COMPLETED_PICKUP',         # Order has been successfully picked up by the customer.
    'CANCELED',                 # Order was canceled (by customer or admin).
    'REFUNDED'                  # Order was refunded.
]
DELIVERY_METHOD_CHOICES = ['HOME_DELIVERY', 'IN_STORE_PICKUP']

RETURN_REQUEST_STATUS_CHOICES = [
    'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED', 'CANCELED_BY_CUSTOMER'
]
RETURN_REASON_CODE_CHOICES = [ # For individual items
    'DEFECTIVE', 'WRONG_ITEM_RECEIVED', 'SIZE_TOO_SMALL', 'SIZE_TOO_LARGE', 
    'UNWANTED_GIFT', 'CHANGED_MIND', 'NOT_AS_DESCRIBED', 'ARRIVED_LATE', 'OTHER'
]
STOCK_REASON_CODE_CHOICES = [ # For StockMovement reason_code
    'INITIAL_STOCK', 'SALE', 'RETURN_RESTOCK', 'RECEPTION_PURCHASE_ORDER', 
    'ADJUSTMENT_DAMAGE', 'ADJUSTMENT_COUNT_POSITIVE', 'ADJUSTMENT_COUNT_NEGATIVE', 
    'ADJUSTMENT_OTHER', 'TRANSFER_IN', 'TRANSFER_OUT'
]


@admin_bp.route('/orders')
def list_orders():
    """Lists all orders, with optional filtering by status and delivery_method."""
    status_filter = request.args.get('status', None)
    delivery_method_filter = request.args.get('delivery_method', None)
    page = request.args.get('page', 1, type=int)
    per_page = 20 # Number of items per page

    query = Sale.query.order_by(Sale.created_at.desc())

    if status_filter and status_filter in ORDER_STATUS_CHOICES:
        query = query.filter(Sale.order_status == status_filter)
    
    if delivery_method_filter and delivery_method_filter in DELIVERY_METHOD_CHOICES:
        query = query.filter(Sale.delivery_method == delivery_method_filter)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    orders = pagination.items
    
    return render_template(
        'order_list.html', 
        orders=orders, 
        pagination=pagination,
        selected_status=status_filter,
        status_choices=ORDER_STATUS_CHOICES,
        selected_delivery_method=delivery_method_filter,
        delivery_method_choices=DELIVERY_METHOD_CHOICES,
        title="Manage Orders"
    )

# --- Return Request Management ---

@admin_bp.route('/returns')
def list_return_requests():
    """Lists all return requests, with optional filtering by status."""
    status_filter = request.args.get('status', None)
    page = request.args.get('page', 1, type=int)
    per_page = 20

    query = ReturnRequest.query.order_by(ReturnRequest.requested_at.desc())

    if status_filter and status_filter in RETURN_REQUEST_STATUS_CHOICES:
        query = query.filter(ReturnRequest.status == status_filter)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return_requests_list = pagination.items
    
    return render_template(
        'return_request_list.html', 
        return_requests=return_requests_list, 
        pagination=pagination,
        selected_status=status_filter,
        status_choices=RETURN_REQUEST_STATUS_CHOICES,
        title="Manage Return Requests"
    )

@admin_bp.route('/returns/<int:return_request_id>')
def view_return_request_detail(return_request_id):
    """Displays detailed information for a specific return request."""
    return_request = ReturnRequest.query.options(
        db.joinedload(ReturnRequest.items).joinedload(ReturnItem.sale_item).joinedload(SaleItem.product),
        db.joinedload(ReturnRequest.sale) # Eager load the original sale details
    ).get_or_404(return_request_id)
    
    return render_template(
        'return_request_detail.html', 
        return_request=return_request, 
        status_choices=RETURN_REQUEST_STATUS_CHOICES,
        reason_code_choices=RETURN_REASON_CODE_CHOICES, # For potential future use in editing items
        title=f"Return Request Details #{return_request.id}"
    )

@admin_bp.route('/returns/update_status/<int:return_request_id>', methods=['POST'])
def update_return_request_status(return_request_id):
    """Updates the status of a specific return request."""
    return_request = ReturnRequest.query.get_or_404(return_request_id)
    new_status = request.form.get('new_status')

    if new_status and new_status in RETURN_REQUEST_STATUS_CHOICES:
        # Add any specific business logic for status transitions here if needed
        # e.g., if status changes to 'COMPLETED', trigger refund process or stock update (not implemented here)
        
        if return_request.status != new_status:
            return_request.status = new_status
            try:
                db.session.commit()
                flash(f"Return Request #{return_request.id} status updated to {new_status.replace('_', ' ')}.", "success")
            except Exception as e:
                db.session.rollback()
                flash(f"Error updating return request status: {str(e)}", "danger")
        else:
            flash(f"Return Request #{return_request.id} status is already {new_status.replace('_', ' ')}.", "info")
    else:
        flash("Invalid status selected.", "warning")

    return redirect(url_for('admin_bp.view_return_request_detail', return_request_id=return_request.id))


# --- Stock Management (WMS) / Fulfillment ---

@admin_bp.route('/wms/picking_dashboard')
def picking_dashboard():
    """Displays orders that are ready for picking and fulfillment."""
    page = request.args.get('page', 1, type=int)
    per_page = 20

    # Orders that are candidates for picking:
    # - E-commerce orders (identified by having a customer_email)
    # - Status is 'PROCESSING' or 'AWAITING_PICKING'
    # - Delivery method is 'HOME_DELIVERY' or 'IN_STORE_PICKUP'
    
    # Using .isnot(None) for customer_email to identify e-commerce sales.
    # For a more robust system, a dedicated 'order_type' field on Sale model might be better.
    query = Sale.query.filter(
        Sale.customer_email.isnot(None), # Indicates an e-commerce type order
        Sale.order_status.in_(['PROCESSING', 'AWAITING_PICKING', 'PICKED', 'PACKED']), # Include PACKED to see what's next
        Sale.delivery_method.in_(['HOME_DELIVERY', 'IN_STORE_PICKUP'])
    ).order_by(Sale.created_at.asc()) # Oldest orders first for picking

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    orders_to_pick = pagination.items
    
    # For each order, count total items. This can be N+1 if not careful.
    # Sale.items is lazy='dynamic', so items.count() is efficient per order.
    # If performance becomes an issue, consider a subquery or specific counter.

    return render_template(
        'wms/picking_dashboard.html',
        orders=orders_to_pick,
        pagination=pagination,
        title="WMS - Orders for Fulfillment"
    )


@admin_bp.route('/wms/receptions/new', methods=['GET', 'POST'])
def new_stock_reception():
    """Form to record new stock reception."""
    if request.method == 'POST':
        product_id = request.form.get('product_id', type=int)
        change_quantity = request.form.get('change_quantity', type=int)
        reason_code = request.form.get('reason_code')
        notes = request.form.get('notes')

        if not product_id or change_quantity is None: # Allow 0 change_quantity for adjustments? Typically no for reception.
            flash("Product and Quantity are required.", "danger")
        elif change_quantity <= 0:
            flash("Received quantity must be positive.", "danger")
        else:
            product = Product.query.get(product_id)
            if not product:
                flash("Selected product not found.", "danger")
            elif reason_code and reason_code not in STOCK_REASON_CODE_CHOICES:
                flash("Invalid reason code selected.", "danger")
            else:
                try:
                    # Update product quantity
                    new_qoh = product.quantity_on_hand + change_quantity
                    product.quantity_on_hand = new_qoh
                    
                    # Create stock movement record
                    stock_move = StockMovement(
                        product_id=product.id,
                        change_quantity=change_quantity, # Positive for reception
                        new_quantity_on_hand=new_qoh,
                        reason_code=reason_code if reason_code else 'RECEPTION_PURCHASE_ORDER', # Default reason
                        notes=notes
                    )
                    db.session.add(stock_move)
                    db.session.add(product) # Add product to session to save its QOH update
                    db.session.commit()
                    flash(f"Stock received successfully for {product.name}. New QOH: {new_qoh}.", "success")
                    return redirect(url_for('admin_bp.list_stock_movements', product_id=product.id)) # Redirect to movements for this product
                except Exception as e:
                    db.session.rollback()
                    flash(f"Error processing stock reception: {str(e)}", "danger")
                    current_app.logger.error(f"Error in new_stock_reception: {e}")
        
        # If POST failed, fall through to render form again with submitted values (if desired)
        # For simplicity, just rerender clean form on error for now.

    products = Product.query.order_by(Product.name).all()
    return render_template(
        'wms/reception_form.html', 
        products=products, 
        reason_choices=STOCK_REASON_CODE_CHOICES,
        title="New Stock Reception"
    )

@admin_bp.route('/wms/stock_movements')
def list_stock_movements():
    """Lists all stock movements, with optional filtering."""
    page = request.args.get('page', 1, type=int)
    per_page = 25
    product_id_filter = request.args.get('product_id', type=int)
    reason_filter = request.args.get('reason_code', None)

    query = StockMovement.query.options(
        db.joinedload(StockMovement.product) # Eager load product info
    ).order_by(StockMovement.created_at.desc())

    if product_id_filter:
        query = query.filter(StockMovement.product_id == product_id_filter)
    if reason_filter and reason_filter in STOCK_REASON_CODE_CHOICES:
        query = query.filter(StockMovement.reason_code == reason_filter)
    
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    movements = pagination.items
    
    products_for_filter = Product.query.order_by(Product.name).all() # For filter dropdown

    return render_template(
        'wms/stock_movement_list.html',
        movements=movements,
        pagination=pagination,
        products_for_filter=products_for_filter,
        reason_choices=STOCK_REASON_CODE_CHOICES,
        selected_product_id=product_id_filter,
        selected_reason=reason_filter,
        title="Stock Movements Log"
    )


@admin_bp.route('/orders/<int:sale_id>')
def view_order_detail(sale_id):
    """Displays detailed information for a specific order."""
    sale = Sale.query.options(
        db.joinedload(Sale.items).joinedload(SaleItem.product) # Eager load items and their products
    ).get_or_404(sale_id)
    
    return render_template(
        'order_detail.html', 
        order=sale, 
        status_choices=ORDER_STATUS_CHOICES,
        delivery_method_choices=DELIVERY_METHOD_CHOICES, # Pass delivery method choices
        title=f"Order Details #{sale.id}"
    )

@admin_bp.route('/orders/update_status/<int:sale_id>', methods=['POST'])
def update_order_status(sale_id):
    """Updates the status of a specific order."""
    sale = Sale.query.get_or_404(sale_id)
    new_status = request.form.get('new_status')
    new_delivery_method = request.form.get('delivery_method')
    new_pickup_instructions = request.form.get('pickup_instructions')

    updated_fields = []
    error_occurred = False

    # Update Order Status
    if new_status and new_status in ORDER_STATUS_CHOICES:
        if sale.order_status not in ['CANCELED', 'REFUNDED', 'DELIVERED'] and \
           new_status in ['PENDING_PAYMENT'] and sale.order_status != 'PENDING_PAYMENT':
            flash(f"Cannot revert order #{sale.id} status from '{sale.order_status}' to '{new_status}'. Action not permitted.", "warning")
        elif sale.order_status != new_status:
            sale.order_status = new_status
            updated_fields.append(f"Status to {new_status.replace('_', ' ')}")
    elif new_status: # If status provided but not valid
        flash(f"Invalid status '{new_status}' selected.", "warning")
        error_occurred = True


    # Update Delivery Method
    if new_delivery_method and new_delivery_method in DELIVERY_METHOD_CHOICES:
        if sale.delivery_method != new_delivery_method:
            sale.delivery_method = new_delivery_method
            updated_fields.append(f"Delivery Method to {new_delivery_method.replace('_', ' ')}")
            
            # Clear pickup instructions if method changes from IN_STORE_PICKUP
            if new_delivery_method != 'IN_STORE_PICKUP':
                if sale.pickup_instructions: # Only mark as updated if it actually changes
                    updated_fields.append("Pickup Instructions cleared")
                sale.pickup_instructions = None 
            elif new_delivery_method == 'IN_STORE_PICKUP': # If method is pickup, update instructions
                 if sale.pickup_instructions != new_pickup_instructions:
                    sale.pickup_instructions = new_pickup_instructions
                    updated_fields.append("Pickup Instructions")

    elif new_delivery_method: # If delivery method provided but not valid
        flash(f"Invalid delivery method '{new_delivery_method}' selected.", "warning")
        error_occurred = True
    
    # Specific update for pickup_instructions if delivery method is already IN_STORE_PICKUP and not changed
    if not error_occurred and sale.delivery_method == 'IN_STORE_PICKUP' and \
       'Delivery Method' not in "".join(updated_fields) and \
       sale.pickup_instructions != new_pickup_instructions:
        sale.pickup_instructions = new_pickup_instructions
        updated_fields.append("Pickup Instructions")


    if not error_occurred and updated_fields:
        try:
            db.session.commit()
            flash(f"Order #{sale.id} updated: {', '.join(updated_fields)}.", "success")
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating order: {str(e)}", "danger")
    elif not updated_fields and not error_occurred:
        flash("No changes detected for the order.", "info")
    
    return redirect(url_for('admin_bp.view_order_detail', sale_id=sale.id))
