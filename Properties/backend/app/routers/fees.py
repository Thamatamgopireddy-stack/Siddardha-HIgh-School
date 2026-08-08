import logging
import re
from datetime import date
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, File, Query, HTTPException, Response, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.session import get_db
from app.models import FeeStructure, FeePayment, Student, User, Section, SchoolClass
from app.utils.ocr import extract_text_from_image
from app.utils.pdf import generate_pdf
from app.utils.excel import parse_excel_or_csv, generate_excel_template


logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/fees", tags=["fees"])


# Pydantic Schemas
class FeeStructureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    academic_year_id: UUID
    name: str
    amount: float
    frequency: str
    is_mandatory: bool


class FeeStructureCreate(BaseModel):
    academic_year_id: UUID
    name: str
    amount: float
    frequency: str
    is_mandatory: bool = True


class FeePaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    student_id: UUID
    fee_structure_id: UUID
    amount_paid: float
    payment_date: date
    receipt_number: str


class FeePaymentCreate(BaseModel):
    student_id: UUID
    fee_structure_id: UUID
    amount_paid: float
    payment_date: date = date.today()
    receipt_number: str


class FeeReceiptParseResult(BaseModel):
    student_id: UUID | None = None
    fee_structure_id: UUID | None = None
    amount_paid: float | None = None
    payment_date: date | None = None
    receipt_number: str | None = None
    raw_text: str


# Helper to convert numbers to words natively
def num_to_words(num: float) -> str:
    under_20 = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    tens = ['Zero', 'Ten', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    
    n = int(num)
    if n < 20:
        return under_20[n]
    if n < 100:
        return tens[n // 10] + ('' if n % 10 == 0 else ' ' + under_20[n % 10])
    if n < 1000:
        return under_20[n // 100] + ' Hundred' + ('' if n % 100 == 0 else ' and ' + num_to_words(n % 100))
    if n < 100000:
        return num_to_words(n // 1000) + ' Thousand' + ('' if n % 1000 == 0 else ' ' + num_to_words(n % 1000))
    return f"{n} Rupees"


# Endpoints
@router.get("/structures")
async def list_fee_structures(
    academic_year_id: UUID | None = None,
    _: User = Depends(require_permission("fees:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(FeeStructure).where(FeeStructure.is_deleted.is_(False))
    if academic_year_id:
        query = query.where(FeeStructure.academic_year_id == str(academic_year_id))
    result = await db.execute(query)
    structures = result.scalars().all()
    return success_response(data=[FeeStructureOut.model_validate(s).model_dump(mode="json") for s in structures])


@router.post("/structures")
async def create_fee_structure(
    body: FeeStructureCreate,
    _: User = Depends(require_permission("fees:edit")),
    db: AsyncSession = Depends(get_db),
):
    struct = FeeStructure(**body.model_dump())
    db.add(struct)
    await db.flush()
    await db.refresh(struct)
    return success_response(data=FeeStructureOut.model_validate(struct).model_dump(mode="json"), message="Fee structure created")


@router.get("/payments")
async def list_fee_payments(
    student_id: UUID | None = None,
    _: User = Depends(require_permission("fees:view")),
    db: AsyncSession = Depends(get_db),
):
    query = select(FeePayment).where(FeePayment.is_deleted.is_(False))
    if student_id:
        query = query.where(FeePayment.student_id == str(student_id))
    result = await db.execute(query)
    payments = result.scalars().all()
    
    # We can join names to return richer detail
    data = []
    for p in payments:
        student_res = await db.execute(select(Student).where(Student.id == p.student_id))
        s = student_res.scalar_one_or_none()
        struct_res = await db.execute(select(FeeStructure).where(FeeStructure.id == p.fee_structure_id))
        struct = struct_res.scalar_one_or_none()
        
        data.append({
            "id": p.id,
            "receipt_number": p.receipt_number,
            "student_name": f"{s.first_name} {s.last_name}" if s else "Unknown Student",
            "admission_number": s.admission_number if s else "—",
            "fee_category": struct.name if struct else "General Fee",
            "amount_paid": float(p.amount_paid),
            "payment_date": p.payment_date.isoformat(),
        })
        
    return success_response(data=data)


@router.post("/payments")
async def log_fee_payment(
    body: FeePaymentCreate,
    _: User = Depends(require_permission("fees:edit")),
    db: AsyncSession = Depends(get_db),
):
    # Verify receipt number unique
    exist = await db.execute(select(FeePayment).where(FeePayment.receipt_number == body.receipt_number, FeePayment.is_deleted.is_(False)))
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Receipt number already exists")

    payment = FeePayment(**body.model_dump())
    db.add(payment)
    await db.flush()
    await db.refresh(payment)
    return success_response(data=FeePaymentOut.model_validate(payment).model_dump(mode="json"), message="Fee payment logged successfully")


@router.post("/payments/receipt-upload")
async def upload_fee_receipt(
    file: UploadFile = File(...),
    student_id: UUID | None = None,
    fee_structure_id: UUID | None = None,
    _: User = Depends(require_permission("fees:edit")),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    content = await file.read()
    ocr_result = await extract_text_from_image(content)
    text = (ocr_result.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Receipt could not be read. Please upload a clearer image.")

    amount = None
    receipt_number = None
    payment_date = None

    amount_matches = re.findall(r"(?:amount|paid|total)\s*[:=]?\s*₹?\s*(\d+(?:[.,]\d{1,2})?)", text, flags=re.IGNORECASE)
    if amount_matches:
        amount = float(amount_matches[-1].replace(",", ""))

    receipt_matches = re.findall(r"(?:receipt|invoice|bill)\s*(?:no|number|#)?\s*[:#-]?\s*([A-Za-z0-9\-_/]+)", text, flags=re.IGNORECASE)
    if receipt_matches:
        receipt_number = receipt_matches[-1].strip()

    date_matches = re.findall(r"(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{4}/\d{2}/\d{2})", text)
    if date_matches:
        try:
            payment_date = date.fromisoformat(date_matches[0].replace('/', '-'))
        except ValueError:
            try:
                payment_date = date.fromisoformat(date_matches[0].split('/')[-1] + '-' + date_matches[0].split('/')[1] + '-' + date_matches[0].split('/')[0])
            except Exception:
                payment_date = None

    if student_id is None:
        student_matches = re.findall(r"(?:student|name|admission)\s*[:#-]?\s*([A-Za-z .]+)", text, flags=re.IGNORECASE)
        name = student_matches[-1].strip() if student_matches else ""
        if name:
            student_res = await db.execute(select(Student).where(Student.first_name.ilike(f"%{name.split()[0]}%"), Student.is_deleted.is_(False)))
            student = student_res.scalar_one_or_none()
            if student:
                student_id = UUID(student.id)

    if fee_structure_id is None:
        fee_structure_res = await db.execute(select(FeeStructure).where(FeeStructure.is_deleted.is_(False)).order_by(FeeStructure.id))
        fee_structure = fee_structure_res.scalars().first()
        if fee_structure:
            fee_structure_id = UUID(fee_structure.id)

    if not student_id or not fee_structure_id or amount is None or not receipt_number:
        raise HTTPException(status_code=400, detail="Receipt could not be parsed well enough to create a fee payment entry. Please enter the details manually.")

    exist = await db.execute(select(FeePayment).where(FeePayment.receipt_number == receipt_number, FeePayment.is_deleted.is_(False)))
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Receipt number already exists")

    payment = FeePayment(
        student_id=str(student_id),
        fee_structure_id=str(fee_structure_id),
        amount_paid=amount,
        payment_date=payment_date or date.today(),
        receipt_number=receipt_number,
    )
    db.add(payment)
    await db.flush()
    await db.refresh(payment)

    return success_response(
        data=FeePaymentOut.model_validate(payment).model_dump(mode="json"),
        message="Receipt processed and fee payment logged successfully",
    )


@router.get("/payments/{payment_id}/receipt")
async def get_payment_receipt_pdf(
    payment_id: UUID,
    _: User = Depends(require_permission("fees:view")),
    db: AsyncSession = Depends(get_db),
):
    p_res = await db.execute(select(FeePayment).where(FeePayment.id == str(payment_id), FeePayment.is_deleted.is_(False)))
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail="Payment record not found")

    student_res = await db.execute(select(Student).where(Student.id == p.student_id))
    s = student_res.scalar_one_or_none()
    struct_res = await db.execute(select(FeeStructure).where(FeeStructure.id == p.fee_structure_id))
    struct = struct_res.scalar_one_or_none()

    # Generate context
    context = {
        "receipt_number": p.receipt_number,
        "payment_date": p.payment_date.strftime("%d %b %Y") if p.payment_date else "",
        "student_name": f"{s.first_name} {s.last_name}" if s else "Unknown Student",
        "admission_number": s.admission_number if s else "—",
        "fee_category": struct.name if struct else "General Tuition Fees",
        "amount_paid": f"{float(p.amount_paid):.2f}",
        "amount_in_words": num_to_words(float(p.amount_paid)),
    }

    try:
        pdf_bytes = generate_pdf("receipt.html", context)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"inline; filename=receipt_{p.receipt_number}.pdf"}
        )
    except Exception as e:
        logger.error(f"Receipt PDF rendering failed: {e}")
        # Return html fallback if WeasyPrint fails locally due to platform library mismatch
        from jinja2 import Environment, FileSystemLoader
        import os
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env = Environment(loader=FileSystemLoader(os.path.join(BASE_DIR, "templates")))
        html_content = env.get_template("receipt.html").render(context)
        return Response(content=html_content, media_type="text/html")


@router.get("/student-balances")
async def list_student_fee_balances(
    class_id: UUID | None = None,
    section_id: UUID | None = None,
    _: User = Depends(require_permission("fees:view")),
    db: AsyncSession = Depends(get_db),
):
    # Fetch all mandatory fee structures to calculate total fee due
    struct_query = select(FeeStructure).where(FeeStructure.is_mandatory == True, FeeStructure.is_deleted.is_(False))
    struct_res = await db.execute(struct_query)
    mandatory_structures = struct_res.scalars().all()
    
    # Map academic_year_id to total mandatory fee amount
    year_fee_map = {}
    for ms in mandatory_structures:
        year_fee_map[ms.academic_year_id] = year_fee_map.get(ms.academic_year_id, 0.0) + float(ms.amount)
        
    # Query students
    query = select(Student).where(Student.is_deleted.is_(False))
    if section_id:
        query = query.where(Student.section_id == str(section_id))
    elif class_id:
        query = query.join(Section, Section.id == Student.section_id).where(Section.class_id == str(class_id))
        
    result = await db.execute(query)
    students = result.scalars().all()
    
    data = []
    for s in students:
        class_name = "—"
        section_name = "—"
        if s.section_id:
            sec_query = select(Section).where(Section.id == s.section_id)
            sec_res = await db.execute(sec_query)
            sec = sec_res.scalar_one_or_none()
            if sec:
                section_name = sec.name
                cls_query = select(SchoolClass).where(SchoolClass.id == sec.class_id)
                cls_res = await db.execute(cls_query)
                cls_val = cls_res.scalar_one_or_none()
                if cls_val:
                    class_name = cls_val.name
                    
        total_fee = year_fee_map.get(s.academic_year_id, 0.0)
        
        # Calculate amount paid
        pay_query = select(FeePayment).where(FeePayment.student_id == s.id, FeePayment.is_deleted.is_(False))
        pay_res = await db.execute(pay_query)
        payments = pay_res.scalars().all()
        total_paid = sum(float(p.amount_paid) for p in payments)
        
        pending_fee = max(0.0, total_fee - total_paid)
        
        data.append({
            "student_id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "admission_number": s.admission_number,
            "class_name": class_name,
            "section_name": section_name,
            "total_fee": total_fee,
            "total_paid": total_paid,
            "pending_fee": pending_fee
        })
        
    return success_response(data=data)


@router.get("/collections/bulk-template")
async def get_fee_collections_bulk_template():
    headers = ["Admission Number", "Amount Paid", "Payment Date", "Payment Mode", "Transaction Reference", "Remarks"]
    sample_rows = [
        {
            "Admission Number": "ADM2026001",
            "Amount Paid": "5000",
            "Payment Date": date.today().isoformat(),
            "Payment Mode": "cash",
            "Transaction Reference": "REC-99812",
            "Remarks": "Term 1 Tuition Fee"
        }
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Fee_Collections_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=fee_collections_import_template.xlsx"}
    )


@router.post("/collections/bulk-import-excel")
async def bulk_import_fee_collections_excel(
    file: UploadFile = File(...),
    _: User = Depends(require_permission("fees:edit")),
    db: AsyncSession = Depends(get_db),
):
    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and CSV (.csv) files are supported.")

    content = await file.read()
    rows = parse_excel_or_csv(content, filename)

    imported_count = 0
    errors = []

    for row_idx, row in enumerate(rows, start=1):
        try:
            adm_num = row.get("Admission Number", "").strip()
            amount_str = row.get("Amount Paid", "").strip()
            pay_date_str = row.get("Payment Date", "").strip() or date.today().isoformat()
            pay_mode = row.get("Payment Mode", "").strip().lower() or "cash"
            tx_ref = row.get("Transaction Reference", "").strip() or None
            remarks = row.get("Remarks", "").strip() or None

            if not adm_num or not amount_str:
                errors.append(f"Row {row_idx}: Missing Admission Number or Amount Paid.")
                continue

            stu_query = select(Student).where(Student.admission_number == adm_num, Student.is_deleted.is_(False))
            student = (await db.execute(stu_query)).scalar_one_or_none()
            if not student:
                errors.append(f"Row {row_idx}: Student with admission number '{adm_num}' not found.")
                continue

            try:
                amount_val = float(amount_str)
                pay_date = date.fromisoformat(pay_date_str[:10])
            except ValueError as ve:
                errors.append(f"Row {row_idx}: Invalid amount or date format ({ve})")
                continue

            receipt_no = tx_ref or f"REC-{date.today().strftime('%Y%m')}-{uuid4().hex[:6].upper()}"

            payment = FeePayment(
                student_id=str(student.id),
                fee_structure_id=None,
                amount_paid=amount_val,
                payment_date=pay_date,
                payment_mode=pay_mode,
                transaction_reference=receipt_no,
                receipt_number=receipt_no,
                remarks=remarks,
            )
            db.add(payment)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: Error logging fee payment ({e})")

    await db.commit()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} fee collection records with {len(errors)} errors."
    )

