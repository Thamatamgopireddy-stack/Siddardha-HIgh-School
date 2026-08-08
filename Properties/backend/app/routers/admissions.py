import re
from datetime import date
from uuid import UUID, uuid4
import logging

from fastapi import APIRouter, Depends, Query, File, UploadFile, HTTPException
from fastapi.responses import Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, ConfigDict

from app.core.dependencies import require_permission, success_response
from app.core.enums import AdmissionStatus, Gender
from app.core.session import get_db
from app.models import Admission, Student, User
from app.utils.ocr import extract_text_from_image
from app.utils.excel import parse_excel_or_csv, generate_excel_template


logger = logging.getLogger("siddardha")

router = APIRouter(prefix="/admissions", tags=["admissions"])


# Pydantic Schemas
class AdmissionCreate(BaseModel):
    academic_year_id: UUID
    applying_for_class_id: UUID
    applicant_name: str
    date_of_birth: date
    gender: Gender
    phone: str
    status: AdmissionStatus = AdmissionStatus.APPLIED
    application_date: date = date.today()
    documents: dict | None = None


class AdmissionUpdate(BaseModel):
    applicant_name: str | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    phone: str | None = None
    status: AdmissionStatus | None = None
    documents: dict | None = None


class AdmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    academic_year_id: UUID
    applying_for_class_id: UUID
    applicant_name: str
    date_of_birth: date
    gender: Gender
    phone: str
    status: AdmissionStatus
    application_date: date
    documents: dict | None


class OCRResult(BaseModel):
    applicant_name: str | None = None
    date_of_birth: str | None = None
    gender: str | None = None
    father_name: str | None = None
    raw_text: str


# Helper regex OCR parser
def parse_ocr_text(text: str) -> dict:
    parsed = {}
    
    # 1. Parse Name
    name_match = re.search(r"Name:\s*([A-Za-z\s]+)", text, re.IGNORECASE)
    if name_match:
        parsed["applicant_name"] = name_match.group(1).strip()
        
    # 2. Parse DOB (DD/MM/YYYY or YYYY-MM-DD)
    dob_match = re.search(r"DOB:\s*([\d\/\-]+)", text, re.IGNORECASE)
    if not dob_match:
        dob_match = re.search(r"Date\s+of\s+Birth:\s*([\d\/\-]+)", text, re.IGNORECASE)
    
    if dob_match:
        dob_str = dob_match.group(1).strip()
        # Clean and standardise dob format
        try:
            if "/" in dob_str:
                parts = dob_str.split("/")
                if len(parts) == 3:
                    if len(parts[2]) == 4:  # DD/MM/YYYY
                        parsed["date_of_birth"] = f"{parts[2]}-{parts[1]}-{parts[0]}"
            elif "-" in dob_str:
                parts = dob_str.split("-")
                if len(parts) == 3:
                    if len(parts[0]) == 4:  # YYYY-MM-DD
                        parsed["date_of_birth"] = dob_str
        except Exception:
            pass

    # 3. Parse Gender
    gender_match = re.search(r"Gender:\s*([A-Za-z]+)", text, re.IGNORECASE)
    if gender_match:
        g = gender_match.group(1).strip().lower()
        if "male" in g:
            parsed["gender"] = "male"
        elif "female" in g:
            parsed["gender"] = "female"
        else:
            parsed["gender"] = "other"
            
    # 4. Father Name
    father_match = re.search(r"Father's\s+Name:\s*([A-Za-z\s]+)", text, re.IGNORECASE)
    if not father_match:
        father_match = re.search(r"Father\s+Name:\s*([A-Za-z\s]+)", text, re.IGNORECASE)
    if father_match:
        parsed["father_name"] = father_match.group(1).strip()

    return parsed


# Endpoints
@router.get("/")
async def list_admissions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    status: AdmissionStatus | None = None,
    _: User = Depends(require_permission("admissions:view")),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * limit
    query = select(Admission).where(Admission.is_deleted.is_(False))
    count_base = select(Admission).where(Admission.is_deleted.is_(False))

    if status:
        query = query.where(Admission.status == status)
        count_base = count_base.where(Admission.status == status)

    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                Admission.applicant_name.ilike(like),
                Admission.phone.ilike(like),
            )
        )
        count_base = count_base.where(
            or_(
                Admission.applicant_name.ilike(like),
                Admission.phone.ilike(like),
            )
        )

    from sqlalchemy import func
    total = (await db.execute(select(func.count()).select_from(count_base.subquery()))).scalar() or 0
    result = await db.execute(query.offset(skip).limit(limit))
    admissions = result.scalars().all()
    
    data = [AdmissionOut.model_validate(a).model_dump(mode="json") for a in admissions]
    return success_response(
        data=data,
        meta={"page": page, "limit": limit, "total": total}
    )


@router.post("/")
async def create_admission(
    body: AdmissionCreate,
    _: User = Depends(require_permission("admissions:create")),
    db: AsyncSession = Depends(get_db),
):
    admission = Admission(**body.model_dump())
    db.add(admission)
    await db.flush()
    await db.refresh(admission)
    return success_response(
        data=AdmissionOut.model_validate(admission).model_dump(mode="json"),
        message="Admission application received"
    )


@router.get("/{admission_id}")
async def get_admission(
    admission_id: UUID,
    _: User = Depends(require_permission("admissions:view")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Admission).where(Admission.id == str(admission_id), Admission.is_deleted.is_(False)))
    adm = res.scalar_one_or_none()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission record not found")
    return success_response(data=AdmissionOut.model_validate(adm).model_dump(mode="json"))


@router.put("/{admission_id}")
async def update_admission(
    admission_id: UUID,
    body: AdmissionUpdate,
    _: User = Depends(require_permission("admissions:edit")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Admission).where(Admission.id == str(admission_id), Admission.is_deleted.is_(False)))
    adm = res.scalar_one_or_none()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission record not found")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(adm, k, v)
    await db.flush()
    return success_response(
        data=AdmissionOut.model_validate(adm).model_dump(mode="json"),
        message="Admission record updated"
    )


@router.post("/ocr")
async def ocr_document(
    file: UploadFile = File(...),
    _: User = Depends(require_permission("admissions:create")),
):
    content = await file.read()
    ocr_res = await extract_text_from_image(content)
    text = ocr_res.get("text", "")
    parsed = parse_ocr_text(text)
    
    return success_response(
        data={
            "applicant_name": parsed.get("applicant_name"),
            "date_of_birth": parsed.get("date_of_birth"),
            "gender": parsed.get("gender"),
            "father_name": parsed.get("father_name"),
            "raw_text": text
        },
        message="Document processed using OCR successfully."
    )


@router.post("/{admission_id}/convert")
async def convert_to_student(
    admission_id: UUID,
    section_id: UUID = Query(...),
    roll_number: str | None = Query(None),
    _: User = Depends(require_permission("admissions:edit")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Admission).where(Admission.id == str(admission_id), Admission.is_deleted.is_(False)))
    adm = res.scalar_one_or_none()
    if not adm:
        raise HTTPException(status_code=404, detail="Admission record not found")

    if adm.status != AdmissionStatus.SHORTLISTED:
        raise HTTPException(status_code=400, detail="Only approved or shortlisted admission candidates can be converted to student registry.")

    # Generate admission number: ADM-{YYYY}-{6 digit random/auto}
    import random
    adm_num = f"ADM-{date.today().year}-{random.randint(100000, 999999)}"

    student = Student(
        admission_number=adm_num,
        academic_year_id=adm.academic_year_id,
        first_name=adm.applicant_name.split(" ")[0],
        middle_name=" ".join(adm.applicant_name.split(" ")[1:-1]) or None,
        last_name=adm.applicant_name.split(" ")[-1] if len(adm.applicant_name.split(" ")) > 1 else "",
        date_of_birth=adm.date_of_birth,
        gender=adm.gender,
        section_id=str(section_id),
        roll_number=roll_number,
        phone=adm.phone,
        is_active=True,
    )
    db.add(student)
    
    # Update admission status
    adm.status = AdmissionStatus.ADMITTED
    await db.flush()

    return success_response(
        data={"student_id": student.id, "admission_number": adm_num},
        message="Admission application converted to registered student record successfully!"
    )


@router.get("/bulk-template")
async def get_admissions_bulk_template():
    headers = ["Applicant Name", "Date of Birth", "Gender", "Phone", "Status"]
    sample_rows = [
        {
            "Applicant Name": "Vikram Das",
            "Date of Birth": "2016-08-20",
            "Gender": "male",
            "Phone": "9876543213",
            "Status": "applied"
        }
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Admissions_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=admissions_import_template.xlsx"}
    )


@router.post("/bulk-import")
async def bulk_import_admissions(
    academic_year_id: UUID = Query(...),
    applying_for_class_id: UUID = Query(...),
    file: UploadFile = File(...),
    _: User = Depends(require_permission("students:create")),
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
            name = row.get("Applicant Name", "").strip()
            dob_str = row.get("Date of Birth", "").strip()
            gender_str = row.get("Gender", "").strip().lower()
            phone = row.get("Phone", "").strip()
            status_str = row.get("Status", "").strip().lower() or "applied"

            if not name or not dob_str or not gender_str or not phone:
                errors.append(f"Row {row_idx}: Missing required fields (Applicant Name, Date of Birth, Gender, Phone).")
                continue

            try:
                dob = date.fromisoformat(dob_str[:10])
                gender = Gender(gender_str)
                adm_status = AdmissionStatus(status_str)
            except Exception as pe:
                errors.append(f"Row {row_idx}: Validation error ({pe})")
                continue

            application_no = f"ADM-{date.today().year}-{uuid4().hex[:6].upper()}"

            admission = Admission(
                application_number=application_no,
                academic_year_id=str(academic_year_id),
                applying_for_class_id=str(applying_for_class_id),
                applicant_name=name,
                date_of_birth=dob,
                gender=gender,
                phone=phone,
                status=adm_status,
                application_date=date.today(),
            )
            db.add(admission)
            imported_count += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: Error importing application ({e})")

    await db.commit()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} admission applications with {len(errors)} errors."
    )

