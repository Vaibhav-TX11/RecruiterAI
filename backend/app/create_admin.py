from app.database import SessionLocal
from app import models, crud, schemas

def create_default_admin():
    db = SessionLocal()
    
    # Check if admin exists
    admin = crud.get_user_by_username(db, "admin")
    if admin:
        print("Admin user already exists")
        return
    
    # Create admin user
    admin_data = schemas.UserCreate(
        email="admin@example.com",
        username="admin",
        full_name="System Administrator",
        password="admin123",  # Change this!
        role="admin"
    )
    
    admin = crud.create_user(db, admin_data)
    print(f"Created admin user: {admin.username}")
    print("Email: admin@example.com")
    print("Password: admin123")
    print("⚠️  CHANGE THIS PASSWORD IN PRODUCTION!")
    
    db.close()

if __name__ == "__main__":
    create_default_admin()
    