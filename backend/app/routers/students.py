import csv
import io
from datetime import date
from uuid import UUID, uuid4
import logging

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import Category, Gender, UserRole
from app.core.session import get_db
from app.models import Student, StudentDocument, User, AuditLog, AcademicYear, Section
from app.utils.gsheets import read_sheet, extract_spreadsheet_id
from app.utils.storage import upload_file

logger = logging.getLogger("educore")

router = APIRouter(prefix="/students", tags=["students"])


@router.get("/academic/years")
async def get_academic_years(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view"))
):
    from app.models.academic import AcademicYear
    result = await db.execute(select(AcademicYear).where(AcademicYear.is_deleted.is_(False)))
    years = result.scalars().all()
    return success_response(data=[{"id": y.id, "name": y.name, "is_current": y.is_current} for y in years])


@router.get("/academic/classes")
async def get_school_classes(
    academic_year_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view"))
):
    from app.models.academic import SchoolClass, Section
    from app.models.student import Student
    from sqlalchemy import func

    query = select(SchoolClass).where(SchoolClass.is_deleted.is_(False))
    if academic_year_id:
        query = query.where(SchoolClass.academic_year_id == str(academic_year_id))
    result = await db.execute(query)
    classes = result.scalars().all()
    
    classes_data = []
    for c in classes:
        # Count students in all sections of this class
        sec_res = await db.execute(select(Section.id).where(Section.class_id == c.id, Section.is_deleted.is_(False)))
        sec_ids = sec_res.scalars().all()
        
        st_count = 0
        if sec_ids:
            count_res = await db.execute(
                select(func.count(Student.id)).where(
                    Student.section_id.in_(sec_ids),
                    Student.is_deleted.is_(False)
                )
            )
            st_count = count_res.scalar() or 0
        
        classes_data.append({
            "id": c.id,
            "name": c.name,
            "academic_year_id": c.academic_year_id,
            "student_count": st_count,
            "students_count": st_count
        })
    return success_response(data=classes_data)


@router.get("/academic/sections")
async def get_sections(
    class_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view"))
):
    from app.models.academic import Section
    from app.models.student import Student
    from sqlalchemy import func

    query = select(Section).where(Section.is_deleted.is_(False))
    if class_id:
        query = query.where(Section.class_id == str(class_id))
    result = await db.execute(query)
    sections = result.scalars().all()
    
    sections_data = []
    for s in sections:
        count_res = await db.execute(
            select(func.count(Student.id)).where(
                Student.section_id == s.id,
                Student.is_deleted.is_(False)
            )
        )
        st_count = count_res.scalar() or 0
        sections_data.append({
            "id": s.id,
            "name": s.name,
            "class_id": s.class_id,
            "student_count": st_count,
            "students_count": st_count
        })
    return success_response(data=sections_data)


# Pydantic Schemas
class StudentCreate(BaseModel):
    admission_number: str
    academic_year_id: UUID
    first_name: str
    middle_name: str | None = None
    last_name: str
    date_of_birth: date
    gender: Gender
    section_id: UUID | None = None
    roll_number: str | None = None
    category: Category | None = None
    phone: str | None = None
    email: EmailStr | None = None
    admission_date: date | None = None

    # Missing fields from SRS
    blood_group: str | None = None
    nationality: str | None = "Indian"
    religion: str | None = None
    aadhaar_number: str | None = None
    previous_school: str | None = None
    tc_number: str | None = None

    # Address
    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    alternate_phone: str | None = None


class StudentUpdate(BaseModel):
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    section_id: UUID | None = None
    roll_number: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    is_active: bool | None = None
    category: Category | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None

    blood_group: str | None = None
    nationality: str | None = None
    religion: str | None = None
    aadhaar_number: str | None = None
    previous_school: str | None = None
    tc_number: str | None = None
    admission_date: date | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    alternate_phone: str | None = None


class GoogleSheetsImportRequest(BaseModel):
    spreadsheet_id: str
    range_name: str = "Sheet1!A:Z"
    academic_year_id: UUID
    section_id: UUID | None = None


class StudentDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    document_type: str
    file_url: str
    file_name: str


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    admission_number: str
    academic_year_id: UUID
    first_name: str
    middle_name: str | None
    last_name: str
    date_of_birth: date
    gender: Gender
    section_id: UUID | None
    roll_number: str | None
    is_active: bool
    phone: str | None
    email: str | None
    category: Category | None
    profile_photo_url: str | None
    blood_group: str | None
    nationality: str | None
    religion: str | None
    aadhaar_number: str | None
    previous_school: str | None
    tc_number: str | None
    admission_date: date | None
    address_line1: str | None
    address_line2: str | None
    city: str | None
    state: str | None
    pincode: str | None
    alternate_phone: str | None


class PromoteRequest(BaseModel):
    target_academic_year_id: UUID
    target_class_id: UUID | None = None
    target_section_id: UUID
    roll_number: str | None = None


def _normalize_header(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def _safe_date(value: str | None) -> date | None:
    if not value:
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        try:
            return date.fromisoformat(text.split("T", 1)[0])
        except ValueError:
            return None


# Endpoints
@router.get("/")
async def list_students(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = None,
    section_id: UUID | None = None,
    class_id: UUID | None = None,
    academic_year_id: UUID | None = None,
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * limit
    query = select(Student).where(Student.is_deleted.is_(False))
    count_base = select(Student).where(Student.is_deleted.is_(False))

    if section_id:
        query = query.where(Student.section_id == str(section_id))
        count_base = count_base.where(Student.section_id == str(section_id))
    elif class_id:
        from app.models.academic import Section
        sec_res = await db.execute(select(Section.id).where(Section.class_id == str(class_id), Section.is_deleted.is_(False)))
        sec_ids = sec_res.scalars().all()
        if sec_ids:
            query = query.where(Student.section_id.in_(sec_ids))
            count_base = count_base.where(Student.section_id.in_(sec_ids))
        else:
            query = query.where(Student.id == "__none__")
            count_base = count_base.where(Student.id == "__none__")

    if academic_year_id:
        query = query.where(Student.academic_year_id == str(academic_year_id))
        count_base = count_base.where(Student.academic_year_id == str(academic_year_id))
    if search:
        like = f"%{search}%"
        query = query.where(
            or_(
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                Student.admission_number.ilike(like),
            )
        )
        count_base = count_base.where(
            or_(
                Student.first_name.ilike(like),
                Student.last_name.ilike(like),
                Student.admission_number.ilike(like),
            )
        )

    from sqlalchemy import func

    total = (await db.execute(select(func.count()).select_from(count_base.subquery()))).scalar() or 0
    result = await db.execute(query.offset(skip).limit(limit))
    students = result.scalars().all()
    data = [StudentOut.model_validate(s).model_dump(mode="json") for s in students]
    return success_response(
        data=data,
        meta={"page": page, "limit": limit, "total": total},
    )


@router.post("/")
async def create_student(
    body: StudentCreate,
    _: User = Depends(require_permission("students:create")),
    db: AsyncSession = Depends(get_db),
):
    # Check if admission number exists
    existing = await db.execute(
        select(Student).where(
            Student.admission_number == body.admission_number,
            Student.is_deleted.is_(False)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Admission number already exists")

    student = Student(**body.model_dump())
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return success_response(
        data=StudentOut.model_validate(student).model_dump(mode="json"),
        message="Student created",
    )


@router.get("/export")
async def export_students(
    academic_year_id: UUID | None = None,
    section_id: UUID | None = None,
    _: User = Depends(require_permission("students:export")),
    db: AsyncSession = Depends(get_db),
):
    query = select(Student).where(Student.is_deleted.is_(False))
    if academic_year_id:
        query = query.where(Student.academic_year_id == academic_year_id)
    if section_id:
        query = query.where(Student.section_id == section_id)

    result = await db.execute(query)
    students = result.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Admission Number", "First Name", "Middle Name", "Last Name",
        "Date of Birth", "Gender", "Roll Number", "Phone", "Email", "Category",
        "Blood Group", "Nationality", "Religion", "Aadhaar Number", "Address Line 1",
        "City", "State", "Pincode"
    ])

    for s in students:
        writer.writerow([
            s.admission_number, s.first_name, s.middle_name or "", s.last_name,
            s.date_of_birth.isoformat(), s.gender.value, s.roll_number or "",
            s.phone or "", s.email or "", s.category.value if s.category else "",
            s.blood_group or "", s.nationality or "", s.religion or "",
            s.aadhaar_number or "", s.address_line1 or "", s.city or "",
            s.state or "", s.pincode or ""
        ])

    output.seek(0)
    filename = "high-school-student-data.csv"
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/google-sheets-import")
async def import_from_google_sheets(
    body: GoogleSheetsImportRequest,
    _: User = Depends(require_permission("students:create")),
    db: AsyncSession = Depends(get_db),
):
    spreadsheet_id = extract_spreadsheet_id(body.spreadsheet_id)
    if not spreadsheet_id:
        raise HTTPException(status_code=400, detail="Please provide a valid Google Spreadsheet ID or URL.")

    rows, error_msg = await read_sheet(spreadsheet_id, body.range_name)
    if error_msg:
        raise HTTPException(status_code=400, detail=error_msg)
    if not rows or len(rows) < 2:
        raise HTTPException(status_code=400, detail="No data rows were found in the specified Google Sheet range. Ensure headers and data rows exist.")

    headers = [_normalize_header(h) for h in rows[0]]
    imported_count = 0
    errors = []

    for row_idx, row in enumerate(rows[1:], start=2):
        try:
            values = {header: row[idx] if idx < len(row) else "" for idx, header in enumerate(headers)}
            admission_number = (values.get("admissionnumber") or values.get("admissionno") or values.get("admissionnum") or "").strip()
            first_name = (values.get("firstname") or values.get("first_name") or "").strip()
            last_name = (values.get("lastname") or values.get("last_name") or "").strip()
            dob_text = (values.get("dateofbirth") or values.get("dob") or values.get("date_of_birth") or "").strip()
            gender_text = (values.get("gender") or "").strip().lower()

            if not admission_number or not first_name or not last_name or not dob_text or not gender_text:
                errors.append(f"Row {row_idx}: Missing required student fields.")
                continue

            existing = await db.execute(select(Student).where(Student.admission_number == admission_number, Student.is_deleted.is_(False)))
            if existing.scalar_one_or_none():
                errors.append(f"Row {row_idx}: Admission number '{admission_number}' already exists.")
                continue

            dob = _safe_date(dob_text)
            if not dob:
                raise ValueError("Date of birth is invalid")

            if gender_text.startswith("f"):
                gender = Gender.FEMALE
            elif gender_text.startswith("o"):
                gender = Gender.OTHER
            else:
                gender = Gender.MALE

            student = Student(
                admission_number=admission_number,
                academic_year_id=str(body.academic_year_id),
                first_name=first_name,
                middle_name=(values.get("middlename") or values.get("middle_name") or "").strip() or None,
                last_name=last_name,
                date_of_birth=dob,
                gender=gender,
                section_id=str(body.section_id) if body.section_id else None,
                roll_number=(values.get("rollnumber") or values.get("roll_number") or "").strip() or None,
                phone=(values.get("phone") or "").strip() or None,
                email=(values.get("email") or "").strip() or None,
                category=Category((values.get("category") or "").strip().lower()) if (values.get("category") or "").strip() else None,
                blood_group=(values.get("bloodgroup") or values.get("blood_group") or "").strip() or None,
                nationality=(values.get("nationality") or "").strip() or "Indian",
                religion=(values.get("religion") or "").strip() or None,
                aadhaar_number=(values.get("aadhaarnumber") or values.get("aadhaar_number") or "").strip() or None,
                previous_school=(values.get("previousschool") or values.get("previous_school") or "").strip() or None,
                tc_number=(values.get("tcnumber") or values.get("tc_number") or "").strip() or None,
                admission_date=_safe_date(values.get("admissiondate") or values.get("admission_date") or ""),
                address_line1=(values.get("addressline1") or values.get("address_line1") or "").strip() or None,
                address_line2=(values.get("addressline2") or values.get("address_line2") or "").strip() or None,
                city=(values.get("city") or "").strip() or None,
                state=(values.get("state") or "").strip() or None,
                pincode=(values.get("pincode") or "").strip() or None,
                alternate_phone=(values.get("alternatephone") or values.get("alternate_phone") or "").strip() or None,
            )
            db.add(student)
            imported_count += 1
        except Exception as exc:
            errors.append(f"Row {row_idx}: Error parsing values ({exc})")

    await db.flush()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} students from Google Sheets with {len(errors)} errors."
    )


from app.services.bulk_import_service import execute_generic_bulk_import, STUDENT_IMPORT_CONFIG, generate_error_report_csv
from fastapi import Response

@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    academic_year_id: UUID = Form(...),
    section_id: UUID | None = Form(None),
    dry_run: bool = Form(True),
    _: User = Depends(require_permission("students:create")),
    db: AsyncSession = Depends(get_db),
):
    try:
        content = await file.read()
        extra_kwargs = {
            "academic_year_id": str(academic_year_id),
            "section_id": str(section_id) if section_id else None
        }
        res = await execute_generic_bulk_import(
            file_bytes=content,
            filename=file.filename,
            config=STUDENT_IMPORT_CONFIG,
            db=db,
            dry_run=dry_run,
            extra_kwargs=extra_kwargs
        )
        # Adapt data for backward compatibility
        error_strings = [f"Row {e['row']}: {e['reason']}" for e in res["errors"]]
        return success_response(
            data={
                "imported": res["valid_count"],
                "total_rows": res["total_rows"],
                "invalid_count": res["invalid_count"],
                "dry_run": res["dry_run"],
                "errors": error_strings,
                "error_details": res["errors"],
                "preview_sample": res["preview_sample"],
            },
            message=f"{'Preview:' if dry_run else 'Import completed:'} {res['valid_count']} valid rows, {res['invalid_count']} invalid rows."
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/bulk-import/error-report")
async def download_import_error_report(
    errors: list[dict],
    _: User = Depends(require_permission("students:create")),
):
    csv_content = generate_error_report_csv(errors)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=student_import_errors.csv"}
    )


@router.get("/{student_id}")
async def get_student(
    student_id: UUID,
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return success_response(data=StudentOut.model_validate(student).model_dump(mode="json"))


@router.put("/{student_id}")
async def update_student(
    student_id: UUID,
    body: StudentUpdate,
    _: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(student, key, value)
    await db.flush()
    return success_response(
        data=StudentOut.model_validate(student).model_dump(mode="json"),
        message="Student updated",
    )


@router.delete("/{student_id}")
async def delete_student(
    student_id: UUID,
    user: User = Depends(require_permission("students:delete")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    student.is_deleted = True
    student.deleted_by = str(user.id)
    student.deleted_at = date.today()
    await db.flush()
    return success_response(message="Student deleted")


@router.post("/{student_id}/photo")
async def upload_photo(
    student_id: UUID,
    file: UploadFile = File(...),
    _: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    content = await file.read()
    key = f"student_photos/{student_id}_{file.filename}"
    url = upload_file(content, key, file.content_type)

    student.profile_photo_url = url
    await db.flush()
    return success_response(data={"url": url}, message="Profile photo uploaded")


@router.get("/{student_id}/documents")
async def list_documents(
    student_id: UUID,
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StudentDocument).where(
            StudentDocument.student_id == str(student_id),
            StudentDocument.is_deleted.is_(False)
        )
    )
    docs = result.scalars().all()
    return success_response(data=[StudentDocumentOut.model_validate(d).model_dump(mode="json") for d in docs])


@router.post("/{student_id}/documents")
async def upload_document(
    student_id: UUID,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    _: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    content = await file.read()
    key = f"student_documents/{student_id}/{file.filename}"
    url = upload_file(content, key, file.content_type)

    doc = StudentDocument(
        student_id=str(student_id),
        document_type=document_type,
        file_url=url,
        file_name=file.filename
    )
    db.add(doc)
    await db.flush()
    return success_response(
        data=StudentDocumentOut.model_validate(doc).model_dump(mode="json"),
        message="Document uploaded"
    )


@router.delete("/{student_id}/documents/{doc_id}")
async def delete_document(
    student_id: UUID,
    doc_id: UUID,
    user: User = Depends(require_permission("students:edit")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StudentDocument).where(
            StudentDocument.id == str(doc_id),
            StudentDocument.student_id == str(student_id),
            StudentDocument.is_deleted.is_(False)
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    doc.is_deleted = True
    doc.deleted_by = str(user.id)
    await db.flush()
    return success_response(message="Document deleted")


@router.post("/{student_id}/promote")
async def promote_student(
    student_id: UUID,
    body: PromoteRequest,
    _: User = Depends(require_permission("students:promote")),
    db: AsyncSession = Depends(get_db),
):
    # Fetch student details
    result = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Check if already promoted to target year
    existing = await db.execute(
        select(Student).where(
            Student.admission_number == student.admission_number,
            Student.academic_year_id == str(body.target_academic_year_id),
            Student.is_deleted.is_(False)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Student is already promoted/registered in target academic year")

    # Pending fees check stub (returns warning flag, but allows promote)
    fee_warning = False
    # If fee structures/payments are present, calculate outstanding here (Mocked as false for simplicity)

    # Create new student record for the next academic year
    new_student = Student(
        admission_number=student.admission_number,
        academic_year_id=str(body.target_academic_year_id),
        first_name=student.first_name,
        middle_name=student.middle_name,
        last_name=student.last_name,
        date_of_birth=student.date_of_birth,
        gender=student.gender,
        section_id=str(body.target_section_id),
        roll_number=body.roll_number or student.roll_number,
        phone=student.phone,
        email=student.email,
        category=student.category,
        profile_photo_url=student.profile_photo_url,
        blood_group=student.blood_group,
        nationality=student.nationality,
        religion=student.religion,
        aadhaar_number=student.aadhaar_number,
        address_line1=student.address_line1,
        address_line2=student.address_line2,
        city=student.city,
        state=student.state,
        pincode=student.pincode,
        alternate_phone=student.alternate_phone,
    )
    db.add(new_student)
    await db.flush()

    return success_response(
        data={
            "promoted_student_id": new_student.id,
            "fee_warning": fee_warning
        },
        message="Student successfully promoted to next academic year"
    )


@router.get("/{student_id}/timeline")
async def get_student_timeline(
    student_id: UUID,
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    # Query student name/admission number to scan audit logs
    res = await db.execute(select(Student).where(Student.id == str(student_id)))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Search audit logs where students module matches or entity_id or matching new_values
    query = select(AuditLog).where(
        AuditLog.module == "students",
        AuditLog.is_deleted.is_(False)
    ).order_by(AuditLog.created_at.desc())

    logs_res = await db.execute(query)
    logs = logs_res.scalars().all()

    timeline_events = []
    student_id_str = str(student_id)
    for l in logs:
        # Match student_id inside log values
        match = False
        if l.new_values and isinstance(l.new_values, dict):
            if l.new_values.get("id") == student_id_str or l.new_values.get("admission_number") == student.admission_number:
                match = True
        if l.action and student_id_str in l.action:
            match = True

        if match:
            timeline_events.append({
                "id": l.id,
                "action": l.action,
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "user_id": l.user_id
            })

    return success_response(data=timeline_events[:20])


@router.post("/{student_id}/portal-access")
async def create_portal_access(
    student_id: UUID,
    _: User = Depends(require_permission("students:admin")),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Student).where(Student.id == str(student_id), Student.is_deleted.is_(False)))
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if student.user_id:
        raise HTTPException(status_code=400, detail="Student already has portal access linked")

    # Generate student username and default credentials
    email = student.email or f"std_{student.admission_number}@school.edu"
    
    # Check if user already exists
    user_res = await db.execute(select(User).where(User.email == email))
    if user_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A user with student's email already exists")

    # Create user with student role
    new_user = User(
        email=email,
        phone=student.phone,
        password_hash=hash_password(f"Std@{student.admission_number}"),
        first_name=student.first_name,
        last_name=student.last_name,
        role=UserRole.STUDENT,
        is_active=True,
        is_email_verified=True,
        force_password_change=True
    )
    db.add(new_user)
    await db.flush()

    student.user_id = new_user.id
    await db.flush()

    return success_response(
        data={"username": email, "default_password": f"Std@{student.admission_number}"},
        message="Portal credentials provisioned successfully"
    )
