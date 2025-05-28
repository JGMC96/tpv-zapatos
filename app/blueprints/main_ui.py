from flask import Blueprint, render_template, current_app, jsonify

main_bp = Blueprint('main', __name__)

@main_bp.route('/ui')
def home_ui():
    return render_template('home.html', title="Welcome")

@main_bp.route('/api/docs')
def api_docs():
    # Simple placeholder for API documentation
    # In a real app, this could render a Swagger UI or similar
    
    # Dynamically list API routes
    api_routes = []
    for rule in current_app.url_map.iter_rules():
        if rule.endpoint != 'static' and not rule.endpoint.endswith('_ui') and not rule.endpoint.startswith('main.'):
            methods = ','.join(sorted(list(m for m in rule.methods if m not in ('HEAD', 'OPTIONS'))))
            api_routes.append({
                "rule": str(rule),
                "endpoint": rule.endpoint,
                "methods": methods,
                "doc": current_app.view_functions[rule.endpoint].__doc__
            })
            
    return render_template('api_docs.html', api_routes=api_routes, title="API Documentation")
