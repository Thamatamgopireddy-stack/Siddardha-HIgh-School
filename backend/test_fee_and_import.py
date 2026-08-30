import asyncio
import io
import csv
from uuid import UUID, uuid4
from datetime import date
from sqlalchemy import select, func

from app.core.session import AsyncSessionLocal, engine
from app.models import Student, FeeStructure, FeeInvoice, FeePayment, AcademicYear, SchoolClass, Section
from app.routers.students import bulk_import
from app.routers.fees import generate_bulk_invoices, log_fee_payment, get_outstanding_dues_report, get_dashboard_live_stats, FeePaymentCreate, BulkInvoiceGenerateRequest

class MockUser:
    id = str(uuid4())
    first_name = "Admin"
    last_name = "User"
    role = "school_admin"
    permissions = ["students:create", "students:view", "fees:edit", "fees:view"]

class MockUploadFile:
    def __init__(self, filename: str, content: bytes):
        self.filename = filename
        self._content = content

    async def read(self):
        return self._content


async def run_tests():
    print("=== STARTING END-TO-END VERIFICATION TESTS ===")
    async with AsyncSessionLocal() as db:
        # Fetch current academic year, class, and section
        ay_res = await db.execute(select(AcademicYear).limit(1))
        ay = ay_res.scalar_one_or_none()
        if not ay:
            print("ERROR: No academic year found in DB.")
            return
        
        cls_res = await db.execute(select(SchoolClass).limit(1))
        cls = cls_res.scalar_one_or_none()

        sec_res = await db.execute(select(Section).limit(1))
        sec = sec_res.scalar_one_or_none()

        # Count initial students
        initial_st_count = (await db.execute(select(func.count()).select_from(Student).where(Student.is_deleted.is_(False)))).scalar() or 0
        print(f"[TEST 1] Initial students count in DB: {initial_st_count}")

        # -------------------------------------------------------------
        # TEST 1: Bulk Import 5 Valid Rows
        # -------------------------------------------------------------
        prefix = f"VTEST{uuid4().hex[:4].upper()}"
        rows_5_valid = [
            ["Admission Number", "First Name", "Last Name", "Date of Birth", "Gender"],
            [f"{prefix}-01", "Aarav", "Kumar", "2010-05-12", "Male"],
            [f"{prefix}-02", "Diya", "Sharma", "2011-03-22", "Female"],
            [f"{prefix}-03", "Karan", "Patel", "2010-11-05", "Male"],
            [f"{prefix}-04", "Ananya", "Reddy", "2011-01-18", "Female"],
            [f"{prefix}-05", "Rohan", "Verma", "2010-08-30", "Male"],
        ]
        csv_out = io.StringIO()
        writer = csv.writer(csv_out)
        writer.writerows(rows_5_valid)
        csv_bytes = csv_out.getvalue().encode("utf-8")

        mock_file_5 = MockUploadFile("valid_5.csv", csv_bytes)
        res_5 = await bulk_import(
            file=mock_file_5,
            academic_year_id=ay.id,
            section_id=sec.id if sec else None,
            _=MockUser(),
            db=db
        )
        print(f"[TEST 1] Bulk Import Result (5 Valid): {res_5}")
        assert res_5["data"]["imported"] == 5, f"Expected 5 imported, got {res_5['data']['imported']}"

        # Verify DB Count
        new_st_count = (await db.execute(select(func.count()).select_from(Student).where(Student.is_deleted.is_(False)))).scalar() or 0
        print(f"[TEST 1] New students count in DB: {new_st_count}")
        assert new_st_count == initial_st_count + 5, f"Expected {initial_st_count + 5}, got {new_st_count}"

        # Verify Dashboard Live Stats Match DB
        stats_res = await get_dashboard_live_stats(_=MockUser(), db=db)
        dash_count = stats_res["data"]["total_students"]
        print(f"[TEST 1] Dashboard Live Stats Student Count: {dash_count}")
        assert dash_count == new_st_count, f"Dashboard count {dash_count} doesn't match DB count {new_st_count}"
        print("[SUCCESS] TEST 1 PASSED: 5 Valid Rows Imported & Dashboard Count Matches DB.")

        # -------------------------------------------------------------
        # TEST 2: Bulk Import 5 Rows with 1 Intentionally Broken Row
        # -------------------------------------------------------------
        prefix2 = f"PTEST{uuid4().hex[:4].upper()}"
        rows_partial = [
            ["Admission Number", "First Name", "Last Name", "Date of Birth", "Gender"],
            [f"{prefix2}-01", "Siddharth", "Rao", "2010-02-14", "Male"],
            [f"{prefix2}-02", "Isha", "Gupta", "2011-06-25", "Female"],
            [f"{prefix2}-03", "BROKEN_ROW", "Invalid", "INVALID_DATE_STAMP", "Male"], # Broken row
            [f"{prefix2}-04", "Meera", "Nair", "2011-09-12", "Female"],
            [f"{prefix2}-05", "Aditya", "Singh", "2010-12-01", "Male"],
        ]
        csv_out2 = io.StringIO()
        writer2 = csv.writer(csv_out2)
        writer2.writerows(rows_partial)
        csv_bytes2 = csv_out2.getvalue().encode("utf-8")

        mock_file_partial = MockUploadFile("partial_5.csv", csv_bytes2)
        res_partial = await bulk_import(
            file=mock_file_partial,
            academic_year_id=ay.id,
            section_id=sec.id if sec else None,
            _=MockUser(),
            db=db
        )
        print(f"[TEST 2] Bulk Import Result (1 Broken): {res_partial}")
        assert res_partial["data"]["imported"] == 4, f"Expected 4 imported, got {res_partial['data']['imported']}"
        assert len(res_partial["data"]["errors"]) == 1, f"Expected 1 error, got {len(res_partial['data']['errors'])}"
        print(f"[TEST 2] Captured Error Reason: {res_partial['data']['errors'][0]}")
        print("[SUCCESS] TEST 2 PASSED: Partial Import 4 Succeeded / 1 Failed with Reason.")

        # -------------------------------------------------------------
        # TEST 3: Fee Management Workflow
        # -------------------------------------------------------------
        print("\n--- TEST 3: FEE MANAGEMENT WORKFLOW ---")
        # 1. Create a Fee Structure for class
        struct_name = f"Term Fee {uuid4().hex[:4].upper()}"
        struct = FeeStructure(
            academic_year_id=str(ay.id),
            class_id=str(cls.id) if cls else None,
            name=struct_name,
            fee_head="Tuition Fee",
            amount=5000.0,
            due_date=date.today(),
            frequency="monthly",
            is_mandatory=True,
        )
        db.add(struct)
        await db.flush()

        # 2. Bulk Generate Invoices for class
        gen_req = BulkInvoiceGenerateRequest(
            fee_structure_id=UUID(struct.id),
            class_id=UUID(cls.id) if cls else UUID(ay.id),
            due_date=date.today()
        )
        gen_res = await generate_bulk_invoices(body=gen_req, _=MockUser(), db=db)
        print(f"[FEE TEST] Bulk Invoices Generated: {gen_res}")

        # Fetch an invoice for testing
        inv_res = await db.execute(select(FeeInvoice).where(FeeInvoice.fee_structure_id == struct.id))
        invoice = inv_res.scalars().first()
        assert invoice is not None, "Invoice was not generated!"
        print(f"[FEE TEST] Target Invoice #{invoice.invoice_number}: Amount Due = Rs.{invoice.amount_due}, Status = {invoice.status}")
        assert invoice.status == "unpaid", f"Expected status unpaid, got {invoice.status}"

        # 3. Record Partial Payment (Rs.2,000 against Rs.5,000 due)
        part_pay_req = FeePaymentCreate(
            student_id=UUID(invoice.student_id),
            invoice_id=UUID(invoice.id),
            amount_paid=2000.0,
            payment_date=date.today(),
            payment_method="cash",
            receipt_number=f"REC-PART-{uuid4().hex[:6]}"
        )
        part_res = await log_fee_payment(body=part_pay_req, current_user=MockUser(), db=db)
        print(f"[FEE TEST] Partial Payment Response: {part_res['message']}")

        # Re-query invoice status
        inv_check1 = (await db.execute(select(FeeInvoice).where(FeeInvoice.id == invoice.id))).scalar_one()
        print(f"[FEE TEST] After Partial Payment: Paid = Rs.{inv_check1.amount_paid}, Status = {inv_check1.status}")
        assert inv_check1.status == "partial", f"Expected status 'partial', got '{inv_check1.status}'"

        # 4. Record Remainder Payment (Rs.3,000 remaining)
        full_pay_req = FeePaymentCreate(
            student_id=UUID(invoice.student_id),
            invoice_id=UUID(invoice.id),
            amount_paid=3000.0,
            payment_date=date.today(),
            payment_method="online",
            transaction_reference="UPI/MOCK/89123",
            receipt_number=f"REC-FULL-{uuid4().hex[:6]}"
        )
        full_res = await log_fee_payment(body=full_pay_req, current_user=MockUser(), db=db)
        print(f"[FEE TEST] Full Payment Response: {full_res['message']}")

        # Re-query invoice status
        inv_check2 = (await db.execute(select(FeeInvoice).where(FeeInvoice.id == invoice.id))).scalar_one()
        print(f"[FEE TEST] After Full Payment: Paid = Rs.{inv_check2.amount_paid}, Status = {inv_check2.status}")
        assert inv_check2.status == "paid", f"Expected status 'paid', got '{inv_check2.status}'"

        # 5. Outstanding Dues Report Check
        rep_res = await get_outstanding_dues_report(class_id=UUID(cls.id) if cls else None, _=MockUser(), db=db)
        print(f"[FEE TEST] Dues Report Totals: {rep_res['data']}")
        assert rep_res['data']['total_collected'] >= 5000.0, "Outstanding report total_collected is incorrect"
        print("[SUCCESS] TEST 3 PASSED: Fee Structure, Bulk Invoices, Partial -> Paid Status Transition, and Outstanding Dues Report Verified!")

    print("\nALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
