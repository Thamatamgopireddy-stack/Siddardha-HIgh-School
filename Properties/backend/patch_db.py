import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "siddardha.db")
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(vehicles)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if "is_tracking" not in columns:
        print("Adding is_tracking to vehicles table")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN is_tracking BOOLEAN DEFAULT 0")
    if "current_latitude" not in columns:
        print("Adding current_latitude to vehicles table")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN current_latitude NUMERIC(9,6)")
    if "current_longitude" not in columns:
        print("Adding current_longitude to vehicles table")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN current_longitude NUMERIC(9,6)")
    if "last_location_update" not in columns:
        print("Adding last_location_update to vehicles table")
        cursor.execute("ALTER TABLE vehicles ADD COLUMN last_location_update DATETIME")
    
    # Patch students table
    cursor.execute("PRAGMA table_info(students)")
    student_columns = [col[1] for col in cursor.fetchall()]
    
    missing_student_cols = {
        "profile_photo_url": "VARCHAR(500)",
        "blood_group": "VARCHAR(10)",
        "nationality": "VARCHAR(50) DEFAULT 'Indian'",
        "religion": "VARCHAR(50)",
        "aadhaar_number": "VARCHAR(255)",
        "previous_school": "VARCHAR(255)",
        "tc_number": "VARCHAR(50)",
        "admission_date": "DATE",
        "address_line1": "VARCHAR(255)",
        "address_line2": "VARCHAR(255)",
        "city": "VARCHAR(100)",
        "state": "VARCHAR(100)",
        "pincode": "VARCHAR(15)",
        "alternate_phone": "VARCHAR(20)"
    }
    
    for col_name, col_type in missing_student_cols.items():
        if col_name not in student_columns:
            print(f"Adding {col_name} to students table")
            cursor.execute(f"ALTER TABLE students ADD COLUMN {col_name} {col_type}")
    
    conn.commit()
    conn.close()
    print("Database patched successfully!")
else:
    print("No database found to patch.")
