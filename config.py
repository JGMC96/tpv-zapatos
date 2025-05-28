import os

# Base directory of the application
basedir = os.path.abspath(os.path.dirname(__file__))

# SQLAlchemy Configuration
SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(basedir, 'app.db')
SQLALCHEMY_TRACK_MODIFICATIONS = False

# Secret key for session management, CSRF protection, etc.
# In a production environment, use a strong, randomly generated key.
SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
