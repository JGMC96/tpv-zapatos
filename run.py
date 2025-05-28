from flask import Flask, request, jsonify
from flask_migrate import Migrate
from app.models import db, Product, Category, Attribute, ProductAttributeValue, ProductImage # Import all relevant models
import config

app = Flask(__name__)
app.config.from_object(config)

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

# Import and register blueprints
from app.blueprints.category_ui import category_bp
from app.blueprints.product_ui import product_bp
from app.blueprints.main_ui import main_bp
from app.blueprints.pos_ui import pos_bp # Import POS blueprint
from app.blueprints.ecommerce_ui import ecommerce_bp # Import Ecommerce blueprint
from app.blueprints.admin_ui import admin_bp # Import Admin blueprint

app.register_blueprint(main_bp) # For home_ui and api_docs
app.register_blueprint(category_bp, url_prefix='/categories/ui')
app.register_blueprint(product_bp, url_prefix='/products/ui')
app.register_blueprint(pos_bp) # Register POS blueprint (prefix is in its definition)
app.register_blueprint(ecommerce_bp) # Register Ecommerce blueprint (prefix is in its definition: /shop)
app.register_blueprint(admin_bp) # Register Admin blueprint (prefix is in its definition: /admin)

# Custom Jinja filter for summing cart quantities
def sum_cart_quantities_filter(cart_dict):
    if not isinstance(cart_dict, dict):
        return 0
    return sum(int(qty) for qty in cart_dict.values())

app.jinja_env.filters['sum_cart_quantities'] = sum_cart_quantities_filter


# CRUD Operations for Products (API Endpoints)

# Create a new product
@app.route('/products', methods=['POST'])
def create_product():
    data = request.get_json()
    if not data or not all(k in data for k in ('name', 'price', 'sku')):
        return jsonify({'message': 'Missing required fields: name, price, sku'}), 400
    
    new_product = Product(
        name=data['name'],
        description=data.get('description'),
        price=data['price'],
        sku=data['sku'],
        category_id=data.get('category_id')
    )
    
    # Validate category_id if provided
    if new_product.category_id:
        category = Category.query.get(new_product.category_id)
        if not category:
            return jsonify({'message': f'Category with id {new_product.category_id} not found'}), 400
            
    # Handle product attributes
    attributes_data = data.get('attributes', [])
    for attr_data in attributes_data:
        attribute_id = attr_data.get('attribute_id')
        value = attr_data.get('value')
        if attribute_id is None or value is None:
            db.session.rollback() # Rollback before returning error
            return jsonify({'message': 'Each attribute must have attribute_id and value'}), 400
        
        attribute = Attribute.query.get(attribute_id)
        if not attribute:
            db.session.rollback()
            return jsonify({'message': f'Attribute with id {attribute_id} not found'}), 400
            
        product_attribute = ProductAttributeValue(product=new_product, attribute_id=attribute_id, value=value)
        db.session.add(product_attribute)

    try:
        db.session.add(new_product) # Add product first before attributes if product is new
        db.session.commit()
    except Exception as e: # Catch potential integrity errors for unique constraints on ProductAttributeValue
        db.session.rollback()
        return jsonify({'message': f'Error saving product attributes: {str(e)}'}), 400

    # Handle product images
    images_data = data.get('images', [])
    default_image_set = False
    if images_data:
        for i, img_data in enumerate(images_data):
            image_url = img_data.get('image_url')
            if not image_url:
                db.session.rollback()
                return jsonify({'message': 'Each image must have an image_url'}), 400
            
            is_default = img_data.get('is_default', False)
            if is_default and not default_image_set:
                default_image_set = True
            elif is_default and default_image_set: # Only one default allowed
                is_default = False 
            
            product_image = ProductImage(
                product=new_product, # Associate with the product
                image_url=image_url,
                alt_text=img_data.get('alt_text'),
                is_default=is_default
            )
            db.session.add(product_image)
        
        # If no image was explicitly set as default, set the first one as default
        if not default_image_set and new_product.images.count() > 0: # new_product.images is a query due to lazy='dynamic'
            # Fetch the first image added in this session for this product and mark it as default
            # This is a bit tricky as images are not yet flushed to DB to be queried directly on relationship
            # A simpler approach for create: mark the first in list as default if none other is.
            # Re-iterating over session-added objects for this product or marking first in list:
            first_image_in_payload_marked_default = False
            for i, img_data in enumerate(images_data): # Assuming order is preserved
                if i == 0 and not default_image_set: # If it's the first image and no other default was set
                     # Find the corresponding object in the session to update its is_default
                     # This is complex. Simpler: if creating, set first image in payload as default if no other default.
                     # The current loop already handles setting the *first* `is_default:true` it sees.
                     # If no `is_default:true` is found, then we need to make one default.
                     pass # Handled by post-loop check if images exist

    try:
        db.session.commit() # Commit product, attributes, and images
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error saving product with images: {str(e)}'}), 400
        
    # Post-commit: Ensure a default image if images exist and none was marked
    if images_data and not default_image_set:
        # Check if any image was actually created and set as default during commit by relationship events
        # This logic is tricky because the objects might not have IDs yet or be easily queryable before a full refresh
        # A robust way: query images for the product, if any exist and none is default, make first default.
        # This requires the product to be committed and have an ID.
        committed_images = ProductImage.query.filter_by(product_id=new_product.id).all()
        if committed_images and not any(img.is_default for img in committed_images):
            committed_images[0].is_default = True
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback() # Should be rare here
                return jsonify({'message': f'Error setting default image: {str(e)}'}), 500


    return jsonify(new_product.to_dict()), 201

from sqlalchemy import or_

# Get all products (with optional search)
@app.route('/products', methods=['GET'])
def get_products():
    search_query = request.args.get('search', None)
    query = Product.query.options(
        db.joinedload(Product.category),
        db.joinedload(Product.images),
        db.joinedload(Product.attributes).joinedload(ProductAttributeValue.attribute)
    )

    if search_query:
        search_term = f"%{search_query}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term)
            )
        )
    
    products = query.order_by(Product.name).all()
    return jsonify([product.to_dict() for product in products]), 200

# Get a single product by ID
@app.route('/products/<int:product_id>', methods=['GET'])
def get_product(product_id):
    product = Product.query.get_or_404(product_id)
    return jsonify(product.to_dict()), 200

# Update an existing product
@app.route('/products/<int:product_id>', methods=['PUT'])
def update_product(product_id):
    product = Product.query.get_or_404(product_id)
    data = request.get_json()

    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    product.name = data.get('name', product.name)
    product.description = data.get('description', product.description)
    product.price = data.get('price', product.price)
    product.sku = data.get('sku', product.sku)
    
    if 'category_id' in data:
        new_category_id = data.get('category_id')
        if new_category_id: # If a new category_id is provided
            category = Category.query.get(new_category_id)
            if not category:
                return jsonify({'message': f'Category with id {new_category_id} not found'}), 400
            product.category_id = new_category_id
        else: # If category_id is explicitly set to null/None
            product.category_id = None
            
    # Handle product attributes update: delete existing and add new ones
    if 'attributes' in data:
        # Clear existing attributes for this product
        ProductAttributeValue.query.filter_by(product_id=product.id).delete()
        
        attributes_data = data.get('attributes', [])
        for attr_data in attributes_data:
            attribute_id = attr_data.get('attribute_id')
            value = attr_data.get('value')
            if attribute_id is None or value is None:
                db.session.rollback()
                return jsonify({'message': 'Each attribute must have attribute_id and value'}), 400
            
            attribute = Attribute.query.get(attribute_id)
            if not attribute:
                db.session.rollback()
                return jsonify({'message': f'Attribute with id {attribute_id} not found'}), 400
                
            product_attribute = ProductAttributeValue(product_id=product.id, attribute_id=attribute_id, value=value)
            db.session.add(product_attribute)

    try:
        db.session.commit()
    except Exception as e: # Catch potential integrity errors
        db.session.rollback()
        return jsonify({'message': f'Error updating product attributes: {str(e)}'}), 400

    # Handle product images update: delete existing and add new ones
    if 'images' in data:
        ProductImage.query.filter_by(product_id=product.id).delete() # Clear existing images
        
        images_data = data.get('images', [])
        default_image_set = False
        processed_images_for_db = []

        for img_data in images_data:
            image_url = img_data.get('image_url')
            if not image_url:
                db.session.rollback()
                return jsonify({'message': 'Each image must have an image_url'}), 400
            
            is_default = img_data.get('is_default', False)
            if is_default and not default_image_set:
                default_image_set = True
            elif is_default and default_image_set:
                is_default = False # Ensure only one default

            processed_images_for_db.append(ProductImage(
                product_id=product.id,
                image_url=image_url,
                alt_text=img_data.get('alt_text'),
                is_default=is_default
            ))

        # If no image was explicitly set as default, and images are provided, set the first one as default
        if not default_image_set and processed_images_for_db:
            processed_images_for_db[0].is_default = True
            default_image_set = True # Mark that we've now handled it.

        for img_to_add in processed_images_for_db:
            db.session.add(img_to_add)

    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Error updating product images: {str(e)}'}), 400
        
    return jsonify(product.to_dict()), 200

# Delete a product
@app.route('/products/<int:product_id>', methods=['DELETE'])
def delete_product(product_id):
    product = Product.query.get_or_404(product_id)
    db.session.delete(product)
    db.session.commit()
    return jsonify({'message': 'Product deleted successfully'}), 200

@app.route('/') # Keep the root for API hello world or a simple API status
def api_root():
    return jsonify({"message": "Welcome to the TPV API. Visit /ui for the web interface or /api/docs for API documentation."})
    
# Note: The UI home is now at /ui handled by main_bp.hello_ui

if __name__ == '__main__':
    # Ensure the app context is available for db operations if needed directly
    # with app.app_context():
    #     db.create_all() # Creates tables if they don't exist, for initial setup without migrations.
                         # For migrations, use flask db init, migrate, upgrade.
    app.run(debug=True)

# CRUD Operations for Categories

# Create a new category
@app.route('/categories', methods=['POST'])
def create_category():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'message': 'Missing required field: name'}), 400
    
    # Check if category name already exists
    if Category.query.filter_by(name=data['name']).first():
        return jsonify({'message': f"Category with name '{data['name']}' already exists."}), 409 # 409 Conflict

    new_category = Category(
        name=data['name'],
        description=data.get('description')
    )
    db.session.add(new_category)
    db.session.commit()
    return jsonify(new_category.to_dict()), 201

# Get all categories
@app.route('/categories', methods=['GET'])
def get_categories():
    categories = Category.query.all()
    return jsonify([category.to_dict() for category in categories]), 200

# Get a single category by ID
@app.route('/categories/<int:category_id>', methods=['GET'])
def get_category(category_id):
    category = Category.query.get_or_404(category_id)
    return jsonify(category.to_dict()), 200

# Update an existing category
@app.route('/categories/<int:category_id>', methods=['PUT'])
def update_category(category_id):
    category = Category.query.get_or_404(category_id)
    data = request.get_json()

    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    if 'name' in data and data['name'] != category.name:
        # Check if new category name already exists
        if Category.query.filter(Category.id != category_id, Category.name == data['name']).first():
            return jsonify({'message': f"Category with name '{data['name']}' already exists."}), 409
        category.name = data['name']
        
    category.description = data.get('description', category.description)
    
    db.session.commit()
    return jsonify(category.to_dict()), 200

# Delete a category
@app.route('/categories/<int:category_id>', methods=['DELETE'])
def delete_category(category_id):
    category = Category.query.get_or_404(category_id)
    
    # Optional: Check if category is associated with any products
    if category.products:
        return jsonify({'message': 'Cannot delete category with associated products. Reassign products first.'}), 400
        
    db.session.delete(category)
    db.session.commit()
    return jsonify({'message': 'Category deleted successfully'}), 200

# CRUD Operations for Attributes (Attribute Types)

# Create a new attribute type
@app.route('/attributes', methods=['POST'])
def create_attribute():
    data = request.get_json()
    if not data or 'name' not in data:
        return jsonify({'message': 'Missing required field: name'}), 400
    
    if Attribute.query.filter_by(name=data['name']).first():
        return jsonify({'message': f"Attribute type with name '{data['name']}' already exists."}), 409

    new_attribute = Attribute(name=data['name'])
    db.session.add(new_attribute)
    db.session.commit()
    return jsonify(new_attribute.to_dict()), 201

# Get all attribute types
@app.route('/attributes', methods=['GET'])
def get_attributes():
    attributes = Attribute.query.all()
    return jsonify([attribute.to_dict() for attribute in attributes]), 200

# Get a single attribute type by ID
@app.route('/attributes/<int:attribute_id>', methods=['GET'])
def get_attribute(attribute_id):
    attribute = Attribute.query.get_or_404(attribute_id)
    return jsonify(attribute.to_dict()), 200

# Update an existing attribute type
@app.route('/attributes/<int:attribute_id>', methods=['PUT'])
def update_attribute(attribute_id):
    attribute = Attribute.query.get_or_404(attribute_id)
    data = request.get_json()

    if not data:
        return jsonify({'message': 'No input data provided'}), 400

    if 'name' in data and data['name'] != attribute.name:
        if Attribute.query.filter(Attribute.id != attribute_id, Attribute.name == data['name']).first():
            return jsonify({'message': f"Attribute type with name '{data['name']}' already exists."}), 409
        attribute.name = data['name']
    
    db.session.commit()
    return jsonify(attribute.to_dict()), 200

# Delete an attribute type
@app.route('/attributes/<int:attribute_id>', methods=['DELETE'])
def delete_attribute(attribute_id):
    attribute = Attribute.query.get_or_404(attribute_id)
    
    # Check if attribute is in use by any products (i.e., if there are ProductAttributeValue entries)
    if ProductAttributeValue.query.filter_by(attribute_id=attribute.id).first():
        return jsonify({'message': 'Cannot delete attribute type as it is currently in use by products.'}), 400
        
    db.session.delete(attribute)
    db.session.commit()
    return jsonify({'message': 'Attribute type deleted successfully'}), 200
