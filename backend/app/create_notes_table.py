"""
Run this script to create the notes table in your database
Usage: python create_notes_table.py
"""

from app.database import engine, Base
from app import models

def create_notes_table():
    """Create the notes table"""
    print("Creating notes table...")
    
    try:
        # This will create only the notes table if it doesn't exist
        # Existing tables won't be affected
        Base.metadata.create_all(bind=engine, tables=[models.Note.__table__])
        print("✓ Notes table created successfully!")
        
    except Exception as e:
        print(f"✗ Error creating notes table: {e}")
        raise

if __name__ == "__main__":
    create_notes_table()
