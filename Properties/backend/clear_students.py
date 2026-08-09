import sqlite3
import os

db_files = ["educore.db", "siddardha.db"]
base_dir = os.path.dirname(__file__)

for db_name in db_files:
    db_path = os.path.join(base_dir, db_name)
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        tables_to_clear = ["attendance", "fee_payments", "exam_marks", "book_issues", "students", "admissions"]
        for table in tables_to_clear:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"Cleared table '{table}' in {db_name}")
            except Exception as e:
                print(f"Could not clear table '{table}' in {db_name}: {e}")
                
        conn.commit()
        conn.close()
        print(f"All student data cleared successfully from {db_name}!")
    else:
        print(f"Database {db_name} not found.")
