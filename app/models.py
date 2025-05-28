from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    products = db.relationship('Product', backref='category', lazy='dynamic') # Changed to lazy='dynamic'

    def __repr__(self):
        return f'<Category {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description
        }

class Product(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=True)
    price = db.Column(db.Float, nullable=False)
    sku = db.Column(db.String(64), unique=True, nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('category.id'), nullable=True)
    attributes = db.relationship('ProductAttributeValue', backref='product', lazy='dynamic', cascade='all, delete-orphan')
    images = db.relationship('ProductImage', backref='product', lazy='dynamic', cascade='all, delete-orphan')
    
    # Stock Information
    quantity_on_hand = db.Column(db.Integer, nullable=False, default=0)
    stock_movements = db.relationship('StockMovement', backref='product', lazy='dynamic', order_by="desc(StockMovement.created_at)")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Product {self.name}>'

    def to_dict(self):
        product_attributes = []
        if self.attributes: # Check if self.attributes is not None
            for pav in self.attributes: # Iterate if self.attributes is not None
                if pav.attribute: # Check if pav.attribute is not None
                    product_attributes.append({
                        'attribute_id': pav.attribute_id,
                        'attribute_name': pav.attribute.name, # Access attribute name
                        'value': pav.value
                    })
        
        data = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'price': self.price,
            'sku': self.sku,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'category_id': self.category_id,
            'attributes': product_attributes
        }
        if self.category:
            data['category_name'] = self.category.name
        
        product_images = []
        if self.images:
            for img in self.images:
                product_images.append({
                    'id': img.id,
                    'image_url': img.image_url,
                    'alt_text': img.alt_text,
                    'is_default': img.is_default
                })
        data['images'] = product_images
        return data

class Attribute(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True) # e.g., "Color", "Size"
    # Relationship to ProductAttributeValue
    values = db.relationship('ProductAttributeValue', backref='attribute', lazy='dynamic')

    def __repr__(self):
        return f'<Attribute {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class ProductAttributeValue(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    attribute_id = db.Column(db.Integer, db.ForeignKey('attribute.id'), nullable=False)
    value = db.Column(db.String(255), nullable=False) # e.g., "Red", "XL"

    # Unique constraint for (product_id, attribute_id)
    __table_args__ = (db.UniqueConstraint('product_id', 'attribute_id', name='uq_product_attribute'),)

    def __repr__(self):
        return f'<ProductAttributeValue product_id={self.product_id} attribute_id={self.attribute_id} value="{self.value}">'

    def to_dict(self):
        # This might not be directly used for API output but can be useful
        return {
            'id': self.id,
            'product_id': self.product_id,
            'attribute_id': self.attribute_id,
            'attribute_name': self.attribute.name if self.attribute else None,
            'value': self.value
        }

class ProductImage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    image_url = db.Column(db.String(2048), nullable=False) # Increased length for URLs
    alt_text = db.Column(db.String(255), nullable=True)
    is_default = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f'<ProductImage {self.id} for product_id={self.product_id} URL={self.image_url}>'

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'image_url': self.image_url,
            'alt_text': self.alt_text,
            'is_default': self.is_default
        }

# POS Models

class Sale(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    total_amount = db.Column(db.Float, nullable=False, default=0.0) # Sum of SaleItem subtotals
    tax_amount = db.Column(db.Float, nullable=False, default=0.0) # For e-commerce, this might be calculated differently
    discount_amount = db.Column(db.Float, nullable=False, default=0.0)
    final_amount = db.Column(db.Float, nullable=False, default=0.0) # total_amount - discount_amount + tax_amount
    
    # Fields for POS
    payment_type = db.Column(db.String(50), nullable=True) # e.g., "cash", "card", "other"
    transaction_id = db.Column(db.String(255), nullable=True) # For card payments or external systems

    # Fields for E-commerce Checkout
    customer_email = db.Column(db.String(120), nullable=True)
    customer_phone = db.Column(db.String(30), nullable=True)
    shipping_address_line1 = db.Column(db.String(255), nullable=True)
    shipping_address_line2 = db.Column(db.String(255), nullable=True)
    shipping_city = db.Column(db.String(100), nullable=True)
    shipping_state = db.Column(db.String(100), nullable=True)
    shipping_postal_code = db.Column(db.String(30), nullable=True)
    shipping_country = db.Column(db.String(100), nullable=True)
    order_status = db.Column(db.String(50), default='PENDING_PAYMENT', nullable=False) # e.g., PENDING_PAYMENT, PROCESSING, SHIPPED, DELIVERED, CANCELED

    # Delivery/Pickup Information
    delivery_method = db.Column(db.String(50), default='HOME_DELIVERY', nullable=False) # 'HOME_DELIVERY', 'IN_STORE_PICKUP'
    pickup_instructions = db.Column(db.String(500), nullable=True) # e.g., "Pickup at counter A after 3 PM" or store address

    items = db.relationship('SaleItem', backref='sale', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Sale id={self.id} final_amount={self.final_amount} created_at={self.created_at}>'

    def calculate_totals(self):
        """Calculates total_amount and final_amount based on items, discount, and tax."""
        self.total_amount = sum(item.subtotal for item in self.items)
        self.final_amount = self.total_amount - self.discount_amount + self.tax_amount
        # Ensure precision, though float precision can be tricky. For monetary values, Decimal is often better.
        self.total_amount = round(self.total_amount, 2)
        self.final_amount = round(self.final_amount, 2)


class SaleItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sale.id'), nullable=False)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    price_at_sale = db.Column(db.Float, nullable=False) # Product's price at the time of this sale
    subtotal = db.Column(db.Float, nullable=False) # quantity * price_at_sale

    # Optional: direct relationship back to product for easier access if needed, though sale.product gives it too.
    # product = db.relationship('Product') # This is already covered by backref from Product.sale_items if added

    def __init__(self, *args, **kwargs):
        super(SaleItem, self).__init__(*args, **kwargs)
        if self.quantity and self.price_at_sale:
            self.subtotal = round(self.quantity * self.price_at_sale, 2)

    def __repr__(self):
        return f'<SaleItem id={self.id} sale_id={self.sale_id} product_id={self.product_id} quantity={self.quantity}>'

    # Optional: Relationship to ReturnItem
    returned_items = db.relationship('ReturnItem', backref='sale_item', lazy='dynamic')


# Return Management Models

class ReturnRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sale_id = db.Column(db.Integer, db.ForeignKey('sale.id'), nullable=False)
    customer_email = db.Column(db.String(120), nullable=True) # For guest returns or quick reference
    reason_text = db.Column(db.Text, nullable=True) # Customer's overall reason for the return
    status = db.Column(db.String(50), nullable=False, default='PENDING_APPROVAL') # e.g., 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PROCESSING', 'COMPLETED'
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    items = db.relationship('ReturnItem', backref='return_request', lazy='dynamic', cascade='all, delete-orphan')
    # Optional: Relationship back to Sale (already defined by Sale.return_requests if added there)
    # sale = db.relationship('Sale', backref=db.backref('return_requests', lazy='dynamic')) # Covered if Sale.return_requests is defined

    def __repr__(self):
        return f'<ReturnRequest id={self.id} sale_id={self.sale_id} status={self.status}>'

class ReturnItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    return_request_id = db.Column(db.Integer, db.ForeignKey('return_request.id'), nullable=False)
    sale_item_id = db.Column(db.Integer, db.ForeignKey('sale_item.id'), nullable=False) # The specific item from the original sale
    quantity = db.Column(db.Integer, nullable=False) # Number of units of this item being returned. Must be <= SaleItem.quantity
    reason_code = db.Column(db.String(50), nullable=True) # e.g., 'DEFECTIVE', 'WRONG_ITEM', 'UNWANTED'
    # Optional: Add a notes field for admin or customer per item
    # notes = db.Column(db.Text, nullable=True)

    # Optional: Relationship back to SaleItem (covered by SaleItem.returned_items)
    # sale_item = db.relationship('SaleItem', backref=db.backref('returned_items', lazy='dynamic'))

    def __repr__(self):
        return f'<ReturnItem id={self.id} return_request_id={self.return_request_id} sale_item_id={self.sale_item_id} quantity={self.quantity}>'


# Stock Management Models

class StockMovement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(db.Integer, db.ForeignKey('product.id'), nullable=False)
    change_quantity = db.Column(db.Integer, nullable=False) # Positive for stock in, negative for stock out
    new_quantity_on_hand = db.Column(db.Integer, nullable=False) # The quantity_on_hand after this movement
    reason_code = db.Column(db.String(100), nullable=True) # e.g., 'INITIAL_STOCK', 'SALE', 'RETURN', 'RECEPTION', 'ADJUSTMENT_DAMAGE', 'ADJUSTMENT_COUNT'
    notes = db.Column(db.Text, nullable=True)
    related_sale_id = db.Column(db.Integer, db.ForeignKey('sale.id'), nullable=True) # Link to Sale if applicable
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Optional: Relationship to Sale (covered by related_sale_id + backref if Sale model has stock_movements)
    # sale = db.relationship('Sale', foreign_keys=[related_sale_id]) # Needs careful backref handling if Sale links back

    def __repr__(self):
        return f'<StockMovement id={self.id} product_id={self.product_id} change={self.change_quantity} new_qoh={self.new_quantity_on_hand}>'
