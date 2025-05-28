from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from app.models import db, Product, Category, Attribute, ProductAttributeValue, ProductImage # Direct DB access
import json

product_bp = Blueprint('product_bp', __name__, template_folder='../../templates/products')

# List Products
@product_bp.route('/')
def list_products_ui():
    products = Product.query.options(
        db.joinedload(Product.category), 
        db.joinedload(Product.images),
        db.joinedload(Product.attributes).joinedload(ProductAttributeValue.attribute) # Eager load attributes and their types
    ).order_by(Product.name).all()
    return render_template('list.html', products=products, title="Manage Products")

# Helper function to process and set product attributes
def _process_attributes(product, attributes_data):
    # Clear existing attributes
    ProductAttributeValue.query.filter_by(product_id=product.id).delete()
    
    processed_attributes = []
    if attributes_data:
        for attr_item in attributes_data:
            attribute_id = attr_item.get('attribute_id')
            value = attr_item.get('value')

            if not attribute_id or not value:
                flash(f"Skipping attribute due to missing ID or value: {attr_item}", "warning")
                continue 
            
            attr_type = Attribute.query.get(attribute_id)
            if not attr_type:
                flash(f"Attribute type with ID {attribute_id} not found. Skipping.", "warning")
                continue
            
            # Check for uniqueness if product already has an ID (i.e., it's an edit)
            # For new products, the product.id is None yet, uniqueness is handled by DB at commit
            if product.id:
                 existing_pav = ProductAttributeValue.query.filter_by(
                    product_id=product.id, 
                    attribute_id=attribute_id
                ).first()
                 if existing_pav: # Should not happen if we delete all first, but good for robustness
                    flash(f"Attribute {attr_type.name} already exists for this product. Updating value.", "info")
                    existing_pav.value = value
                    processed_attributes.append(existing_pav)
                    continue # Skip creating a new one

            processed_attributes.append(ProductAttributeValue(
                product_id=product.id, # Will be None for new product, set by relationship backref
                attribute_id=attribute_id, 
                value=value
            ))
    return processed_attributes

# Helper function to process and set product images
def _process_images(product, images_data):
    ProductImage.query.filter_by(product_id=product.id).delete()
    
    processed_images = []
    default_image_set = False
    if images_data:
        for i, img_item in enumerate(images_data):
            image_url = img_item.get('image_url')
            if not image_url:
                flash("Skipping image due to missing URL.", "warning")
                continue

            is_default_str = str(img_item.get('is_default', 'false')).lower()
            is_default = is_default_str == 'true' or is_default_str == 'on'


            current_is_default = False
            if is_default and not default_image_set:
                current_is_default = True
                default_image_set = True
            elif is_default and default_image_set: # Only one default allowed
                flash("Multiple images marked as default. Only the first one will be set.", "info")
                current_is_default = False
            
            processed_images.append(ProductImage(
                product_id=product.id, # Will be None for new product
                image_url=image_url,
                alt_text=img_item.get('alt_text'),
                is_default=current_is_default
            ))
            
        # If no image was explicitly set as default, set the first one if any images were processed
        if not default_image_set and processed_images:
            processed_images[0].is_default = True
            default_image_set = True
            
    return processed_images


# Add Product (GET and POST)
@product_bp.route('/add', methods=['GET', 'POST'])
def add_product_ui():
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        price_str = request.form.get('price')
        sku = request.form.get('sku')
        category_id_str = request.form.get('category_id')

        if not name or not sku or not price_str:
            flash('Product Name, SKU, and Price are required.', 'danger')
            # Repopulate form for correction (similar to GET)
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title="Add New Product", 
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   product=request.form, # Pass submitted form data back
                                   action_url=url_for('product_bp.add_product_ui'))
        
        try:
            price = float(price_str)
        except ValueError:
            flash('Invalid price format.', 'danger')
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title="Add New Product", 
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   product=request.form,
                                   action_url=url_for('product_bp.add_product_ui'))

        category_id = int(category_id_str) if category_id_str else None
        if category_id and not Category.query.get(category_id):
            flash('Selected category not found.', 'danger')
            # Repopulate and return
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title="Add New Product", 
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   product=request.form,
                                   action_url=url_for('product_bp.add_product_ui'))


        new_product = Product(
            name=name, 
            description=description, 
            price=price, 
            sku=sku, 
            category_id=category_id
        )
        db.session.add(new_product)
        
        # Process attributes - must happen after new_product is associated with session for product_id
        # For new products, we need to flush to get product.id if not using relationship back_populates
        # Or, pass new_product object directly to helper which assigns it to pav.product
        
        raw_attributes = [
            {'attribute_id': request.form.get(f'attributes[{i}][attribute_id]'), 'value': request.form.get(f'attributes[{i}][value]')}
            for i in range(len(request.form.getlist('attributes[][attribute_id]'))) # Rough estimate of count
            if request.form.get(f'attributes[{i}][attribute_id]') # Ensure it exists
        ]
        # Filter out empty/incomplete attributes from form submission if JS didn't prevent them
        attributes_data = [attr for attr in raw_attributes if attr['attribute_id'] and attr['value']]


        # Process images
        raw_images = []
        # This parsing is tricky with dynamic names. The JS should structure names that are easy to parse.
        # Example: images[0][image_url], images[0][alt_text], images[0][is_default]
        # Number of images can be determined by one of its consistent fields, e.g. image_url
        num_images = len(request.form.getlist("images[][image_url]"))
        for i in range(num_images):
            url = request.form.get(f"images[{i}][image_url]")
            if not url: continue # Skip if URL is missing
            alt = request.form.get(f"images[{i}][alt_text]")
            is_def_str = request.form.get(f"images[{i}][is_default]", "false") # Default to "false" if not present
            is_def = is_def_str.lower() in ['true', 'on', 'yes', '1'] # Checkbox value can be 'on' or 'true'
            raw_images.append({'image_url': url, 'alt_text': alt, 'is_default': is_def})
        images_data = raw_images

        # Add product to session to prepare for flush (needed if helpers rely on product.id)
        # However, if using relationship backrefs correctly, direct assignment to pav.product works
        
        product_attributes = _process_attributes(new_product, attributes_data) # This won't work without product_id
        for pa in product_attributes:
            pa.product = new_product # Explicitly associate if product_id was not set
            db.session.add(pa)
            
        product_images = _process_images(new_product, images_data)
        for pi in product_images:
            pi.product = new_product
            db.session.add(pi)

        try:
            db.session.commit()
            flash(f"Product '{new_product.name}' added successfully.", 'success')
            return redirect(url_for('product_bp.list_products_ui'))
        except Exception as e:
            db.session.rollback()
            flash(f"Error adding product: {str(e)}", 'danger')
            # Log error e
            current_app.logger.error(f"Error adding product: {e}")


    # GET request or failed POST
    categories = Category.query.order_by(Category.name).all()
    available_attributes = Attribute.query.order_by(Attribute.name).all()
    return render_template('form.html', 
                           title="Add New Product", 
                           categories=categories, 
                           available_attributes=available_attributes,
                           available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                           action_url=url_for('product_bp.add_product_ui'))


@product_bp.route('/edit/<int:product_id>', methods=['GET', 'POST'])
def edit_product_ui(product_id):
    product = Product.query.options(
        db.joinedload(Product.attributes).joinedload(ProductAttributeValue.attribute),
        db.joinedload(Product.images)
    ).get_or_404(product_id)

    if request.method == 'POST':
        product.name = request.form.get('name')
        product.description = request.form.get('description')
        price_str = request.form.get('price')
        product.sku = request.form.get('sku')
        category_id_str = request.form.get('category_id')

        if not product.name or not product.sku or not price_str:
            flash('Product Name, SKU, and Price are required.', 'danger')
            # Repopulate form for correction (similar to GET)
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title=f"Edit Product: {product.name}", 
                                   product=product, # Pass existing product
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   action_url=url_for('product_bp.edit_product_ui', product_id=product_id))
        
        try:
            product.price = float(price_str)
        except ValueError:
            flash('Invalid price format.', 'danger')
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title=f"Edit Product: {product.name}", 
                                   product=product, 
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   action_url=url_for('product_bp.edit_product_ui', product_id=product_id))

        product.category_id = int(category_id_str) if category_id_str else None
        if product.category_id and not Category.query.get(product.category_id):
            flash('Selected category not found.', 'danger')
            # Repopulate and return
            categories = Category.query.order_by(Category.name).all()
            available_attributes = Attribute.query.order_by(Attribute.name).all()
            return render_template('form.html', title=f"Edit Product: {product.name}", 
                                   product=product, 
                                   categories=categories, 
                                   available_attributes=available_attributes,
                                   available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                                   action_url=url_for('product_bp.edit_product_ui', product_id=product_id))

        # Process attributes
        raw_attributes = []
        num_attributes = 0
        # Determine num_attributes by checking how many attribute_id fields were submitted
        submitted_attr_ids = request.form.getlist("attributes[][attribute_id]")
        num_attributes = len(submitted_attr_ids)

        for i in range(num_attributes):
            attr_id = request.form.get(f'attributes[{i}][attribute_id]')
            val = request.form.get(f'attributes[{i}][value]')
            if attr_id and val: # Only consider if both are present
                 raw_attributes.append({'attribute_id': attr_id, 'value': val})
        attributes_data = raw_attributes


        # Process images
        raw_images = []
        num_images = len(request.form.getlist("images[][image_url]"))
        for i in range(num_images):
            url = request.form.get(f"images[{i}][image_url]")
            if not url: continue
            alt = request.form.get(f"images[{i}][alt_text]")
            is_def_str = request.form.get(f"images[{i}][is_default]", "false")
            is_def = is_def_str.lower() in ['true', 'on', 'yes', '1']
            raw_images.append({'image_url': url, 'alt_text': alt, 'is_default': is_def})
        images_data = raw_images

        # Update logic: clear existing and add new ones
        ProductAttributeValue.query.filter_by(product_id=product.id).delete()
        product_attributes = _process_attributes(product, attributes_data) # Re-use helper, product.id exists
        for pa in product_attributes:
            # pa.product_id = product.id # Ensure product_id is set if helper doesn't
            db.session.add(pa) # Add to session

        ProductImage.query.filter_by(product_id=product.id).delete()
        product_images = _process_images(product, images_data) # Re-use helper
        for pi in product_images:
            # pi.product_id = product.id
            db.session.add(pi)

        try:
            db.session.commit()
            flash(f"Product '{product.name}' updated successfully.", 'success')
            return redirect(url_for('product_bp.list_products_ui'))
        except Exception as e:
            db.session.rollback()
            flash(f"Error updating product: {str(e)}", 'danger')
            # Log error e
            current_app.logger.error(f"Error updating product: {e}")


    # GET request
    categories = Category.query.order_by(Category.name).all()
    available_attributes = Attribute.query.order_by(Attribute.name).all()
    return render_template('form.html', 
                           title=f"Edit Product: {product.name}", 
                           product=product, 
                           categories=categories, 
                           available_attributes=available_attributes,
                           available_attributes_json=json.dumps([a.to_dict() for a in available_attributes]),
                           action_url=url_for('product_bp.edit_product_ui', product_id=product_id))


@product_bp.route('/delete/<int:product_id>', methods=['POST'])
def delete_product_ui(product_id):
    product = Product.query.get_or_404(product_id)
    try:
        # Cascading deletes for ProductAttributeValue and ProductImage are handled by DB relationships
        db.session.delete(product)
        db.session.commit()
        flash(f"Product '{product.name}' deleted successfully.", 'success')
    except Exception as e:
        db.session.rollback()
        flash(f"Error deleting product: {str(e)}", 'danger')
        # Log error e
        current_app.logger.error(f"Error deleting product: {e}")
    return redirect(url_for('product_bp.list_products_ui'))
