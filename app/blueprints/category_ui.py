from flask import Blueprint, render_template, request, redirect, url_for, flash
from app.models import db, Category # Direct DB access for now

category_bp = Blueprint('category_bp', __name__, template_folder='../../templates/categories')

# List Categories
@category_bp.route('/')
def list_categories_ui():
    categories = Category.query.order_by(Category.name).all()
    return render_template('list.html', categories=categories, title="Manage Categories")

# Add Category (GET and POST)
@category_bp.route('/add', methods=['GET', 'POST'])
def add_category_ui():
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        
        if not name:
            flash('Category name is required.', 'danger')
        else:
            existing_category = Category.query.filter_by(name=name).first()
            if existing_category:
                flash(f"Category with name '{name}' already exists.", 'warning')
            else:
                new_category = Category(name=name, description=description)
                db.session.add(new_category)
                db.session.commit()
                flash(f"Category '{name}' added successfully.", 'success')
                return redirect(url_for('category_bp.list_categories_ui'))
        
        # If POST failed or had issues, re-render form with current values
        return render_template('form.html', category={'name': name, 'description': description}, title="Add New Category", action_url=url_for('category_bp.add_category_ui'))

    return render_template('form.html', title="Add New Category", action_url=url_for('category_bp.add_category_ui'))

# Edit Category (GET and POST)
@category_bp.route('/edit/<int:category_id>', methods=['GET', 'POST'])
def edit_category_ui(category_id):
    category = Category.query.get_or_404(category_id)
    if request.method == 'POST':
        name = request.form.get('name')
        description = request.form.get('description')
        
        if not name:
            flash('Category name is required.', 'danger')
        else:
            # Check if new name conflicts with another existing category
            existing_category = Category.query.filter(Category.id != category_id, Category.name == name).first()
            if existing_category:
                flash(f"Another category with name '{name}' already exists.", 'warning')
            else:
                category.name = name
                category.description = description
                db.session.commit()
                flash(f"Category '{name}' updated successfully.", 'success')
                return redirect(url_for('category_bp.list_categories_ui'))

        # If POST failed or had issues, re-render form with current values
        return render_template('form.html', category={'id': category_id, 'name': name, 'description': description}, title=f"Edit Category: {category.name}", action_url=url_for('category_bp.edit_category_ui', category_id=category_id))

    return render_template('form.html', category=category, title=f"Edit Category: {category.name}", action_url=url_for('category_bp.edit_category_ui', category_id=category_id))

# Delete Category (POST, as it's a destructive action)
@category_bp.route('/delete/<int:category_id>', methods=['POST'])
def delete_category_ui(category_id):
    category = Category.query.get_or_404(category_id)
    if category.products.first(): # Check if category has products
        flash(f"Cannot delete category '{category.name}' as it has associated products. Please reassign products first.", 'danger')
    else:
        db.session.delete(category)
        db.session.commit()
        flash(f"Category '{category.name}' deleted successfully.", 'success')
    return redirect(url_for('category_bp.list_categories_ui'))
