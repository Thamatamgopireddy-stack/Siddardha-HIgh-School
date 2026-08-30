import asyncio
import os
import subprocess
import glob
from uuid import uuid4
from datetime import date
from sqlalchemy import select

from app.core.session import AsyncSessionLocal
from app.models import Student, User, AcademicYear

async def run_backup_restore_test():
    print("=== STARTING BACKUP & RESTORE VERIFICATION TEST ===")
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    # 1. Seed unique test student in database
    unique_tag = uuid4().hex[:6].upper()
    test_adm_no = f"BACKUP-TEST-{unique_tag}"

    async with AsyncSessionLocal() as db:
        ay_res = await db.execute(select(AcademicYear).limit(1))
        ay = ay_res.scalar_one_or_none()

        test_student = Student(
            academic_year_id=str(ay.id) if ay else None,
            admission_number=test_adm_no,
            first_name="BackupTestFirstName",
            last_name="BackupTestLastName",
            date_of_birth=date(2012, 1, 1),
            gender="MALE",
        )
        db.add(test_student)
        await db.commit()
        print(f"[STEP 1] Created test record: {test_student.first_name} {test_student.last_name} ({test_adm_no})")

    # 2. Run backup.bat --silent
    print("\n[STEP 2] Executing backup.bat...")
    backup_bat_path = os.path.join(root_dir, "backup.bat")
    res = subprocess.run([backup_bat_path, "--silent"], cwd=root_dir, capture_output=True, text=True)
    print(f"[BACKUP STDOUT]\n{res.stdout}")

    # Check for created backup file in backups/ folder
    backups_dir = os.path.join(root_dir, "backups")
    backup_files = sorted(glob.glob(os.path.join(backups_dir, "*")), key=os.path.getmtime)
    assert len(backup_files) > 0, "No backup file found in backups/ directory!"
    latest_backup = backup_files[-1]
    print(f"[STEP 2 SUCCESS] Backup created at: {latest_backup}")

    # 3. Mutate/Delete test student record from database
    print("\n[STEP 3] Mutating live database (deleting test record)...")
    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Student).where(Student.admission_number == test_adm_no))
        st = st_res.scalar_one_or_none()
        if st:
            await db.delete(st)
            await db.commit()
            print(f"[STEP 3] Deleted test student {test_adm_no} from database.")

    # Confirm record is gone
    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Student).where(Student.admission_number == test_adm_no))
        assert st_res.scalar_one_or_none() is None, "Failed to delete test record before restore!"
        print("[STEP 3 CONFIRMED] Test record is verified gone from live DB.")

    # 4. Run restore.bat supplying backup file path and --force flag
    print(f"\n[STEP 4] Executing restore.bat against {latest_backup}...")
    restore_bat_path = os.path.join(root_dir, "restore.bat")
    res_restore = subprocess.run([restore_bat_path, latest_backup, "--force"], cwd=root_dir, capture_output=True, text=True)
    print(f"[RESTORE STDOUT]\n{res_restore.stdout}")

    # 5. Confirm test record is restored in live database!
    print("\n[STEP 5] Verifying database state post-restore...")
    async with AsyncSessionLocal() as db:
        st_res = await db.execute(select(Student).where(Student.admission_number == test_adm_no))
        restored_st = st_res.scalar_one_or_none()
        assert restored_st is not None, f"Restored student record {test_adm_no} not found after restore.bat!"
        assert restored_st.first_name == "BackupTestFirstName", f"Expected BackupTestFirstName, got {restored_st.first_name}"
        print(f"[STEP 5 SUCCESS] Test student record successfully restored! ({restored_st.first_name} {restored_st.last_name})")

    print("\nALL BACKUP & RESTORE VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_backup_restore_test())
