import csv
import io
from datetime import date, datetime, timedelta
from typing import Any
from uuid import UUID, uuid4
import logging

from fastapi import APIRouter, Depends, Query, File, UploadFile, Form, HTTPException, status
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel, ConfigDict, EmailStr
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_permission, success_response
from app.core.enums import Category, Gender, UserRole
from app.core.session import get_db
from app.models import Student, StudentDocument, User, AuditLog, AcademicYear, Section
from app.core.security import hash_password
from app.utils.gsheets import read_sheet
from app.utils.storage import upload_file
from app.utils.excel import parse_excel_or_csv, generate_excel_template


logger = logging.getLogger("siddardha")

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
    from app.models.academic import SchoolClass
    query = select(SchoolClass).where(SchoolClass.is_deleted.is_(False))
    if academic_year_id:
        query = query.where(SchoolClass.academic_year_id == str(academic_year_id))
    result = await db.execute(query)
    classes = result.scalars().all()
    return success_response(data=[{"id": c.id, "name": c.name, "academic_year_id": c.academic_year_id} for c in classes])


@router.get("/academic/sections")
async def get_sections(
    class_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_permission("students:view"))
):
    from app.models.academic import Section
    query = select(Section).where(Section.is_deleted.is_(False))
    if class_id:
        query = query.where(Section.class_id == str(class_id))
    result = await db.execute(query)
    sections = result.scalars().all()
    return success_response(data=[{"id": s.id, "name": s.name, "class_id": s.class_id} for s in sections])


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


def _normalize_header(value: Any) -> str:
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def _safe_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value

    text = str(value).strip()
    if not text:
        return None

    # Handle Excel serial dates (e.g. 42138 or 42138.0)
    try:
        val_float = float(text)
        if 1000 < val_float < 100000:
            return date(1899, 12, 30) + timedelta(days=int(val_float))
    except (ValueError, OverflowError):
        pass

    if "T" in text:
        text = text.split("T", 1)[0]
    if " " in text:
        text = text.split(" ", 1)[0]

    date_formats = [
        "%Y-%m-%d", "%Y/%m/%d",
        "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y",
        "%m/%d/%Y", "%m-%d-%Y",
        "%d-%b-%Y", "%d-%B-%Y", "%d %b %Y", "%d %B %Y",
        "%b %d, %Y", "%B %d, %Y"
    ]
    for fmt in date_formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue

    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _safe_gender(value: Any) -> Gender:
    if not value:
        return Gender.MALE
    text = str(value).strip().lower()
    if text.startswith(("f", "g")) or "female" in text or "girl" in text:
        return Gender.FEMALE
    if text.startswith("o") or "other" in text:
        return Gender.OTHER
    return Gender.MALE


def _safe_category(value: Any) -> Category | None:
    if not value:
        return None
    text = str(value).strip().lower()
    if "obc" in text or "bc" in text:
        return Category.OBC
    if text in ("sc", "scheduled caste"):
        return Category.SC
    if text in ("st", "scheduled tribe"):
        return Category.ST
    if "ews" in text:
        return Category.EWS
    if "gen" in text or "general" in text:
        return Category.GENERAL
    try:
        return Category(text)
    except ValueError:
        return Category.GENERAL


# Endpoints
@router.get("/")
async def list_students(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=2000),
    search: str | None = None,
    section_id: str | None = None,
    class_id: str | None = None,
    academic_year_id: str | None = None,
    _: User = Depends(require_permission("students:view")),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Section
    skip = (page - 1) * limit
    query = select(Student).where(Student.is_deleted.is_(False))
    count_base = select(Student).where(Student.is_deleted.is_(False))

    if section_id and str(section_id).strip() not in ("undefined", "null", "", "None"):
        sec_str = str(section_id).strip()
        query = query.where(Student.section_id == sec_str)
        count_base = count_base.where(Student.section_id == sec_str)
    elif class_id and str(class_id).strip() not in ("undefined", "null", "", "None"):
        cls_str = str(class_id).strip()
        sec_res = await db.execute(select(Section.id).where(Section.class_id == cls_str, Section.is_deleted.is_(False)))
        sec_ids = [s[0] for s in sec_res.all()]
        if sec_ids:
            query = query.where(Student.section_id.in_(sec_ids))
            count_base = count_base.where(Student.section_id.in_(sec_ids))

    if academic_year_id and str(academic_year_id).strip() not in ("undefined", "null", "", "None"):
        ay_str = str(academic_year_id).strip()
        query = query.where(Student.academic_year_id == ay_str)
        count_base = count_base.where(Student.academic_year_id == ay_str)

    if search and search.strip():
        like = f"%{search.strip()}%"
        search_filter = or_(
            Student.first_name.ilike(like),
            Student.last_name.ilike(like),
            Student.admission_number.ilike(like),
            Student.roll_number.ilike(like),
            Student.phone.ilike(like),
        )
        query = query.where(search_filter)
        count_base = count_base.where(search_filter)

    from sqlalchemy import func

    total = (await db.execute(select(func.count()).select_from(count_base.subquery()))).scalar() or 0
    result = await db.execute(query.order_by(Student.first_name.asc()).offset(skip).limit(limit))
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

    dump = body.model_dump()
    dump["academic_year_id"] = str(dump["academic_year_id"])
    if dump.get("section_id"):
        dump["section_id"] = str(dump["section_id"])

    student = Student(**dump)
    db.add(student)
    await db.flush()
    await db.refresh(student)
    return success_response(
        data=StudentOut.model_validate(student).model_dump(mode="json"),
        message="Student created",
    )


@router.get("/export")
async def export_students(
    academic_year_id: str | None = None,
    section_id: str | None = None,
    class_id: str | None = None,
    _: User = Depends(require_permission("students:export")),
    db: AsyncSession = Depends(get_db),
):
    from app.models import Section
    query = select(Student).where(Student.is_deleted.is_(False))
    if academic_year_id and str(academic_year_id).strip() not in ("undefined", "null", "", "None"):
        query = query.where(Student.academic_year_id == str(academic_year_id).strip())
    if section_id and str(section_id).strip() not in ("undefined", "null", "", "None"):
        query = query.where(Student.section_id == str(section_id).strip())
    elif class_id and str(class_id).strip() not in ("undefined", "null", "", "None"):
        sec_res = await db.execute(select(Section.id).where(Section.class_id == str(class_id).strip(), Section.is_deleted.is_(False)))
        sec_ids = [s[0] for s in sec_res.all()]
        if sec_ids:
            query = query.where(Student.section_id.in_(sec_ids))

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
    rows = await read_sheet(body.spreadsheet_id, body.range_name)
    if not rows:
        raise HTTPException(status_code=400, detail="No rows were returned from Google Sheets. Check the spreadsheet ID, range, and permissions.")

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

            gender = _safe_gender(gender_text)

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
                category=_safe_category(values.get("category")),
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


@router.get("/bulk-template")
async def get_student_bulk_template():
    headers = [
        "SECTION", "NAME OF THE STUDENT", "SURNAME", "PEN NO", "AADHAAR NO",
        "FATHER NAME", "MOTHER NAME", "R.NO", "ADMIN NO", "CASTE",
        "SUB CASTE", "DOB", "VILLAGE", "MOBILE", "EXTRA CELL NO", "HOSTEL", "H.NO"
    ]
    sample_rows = [
        {"SECTION": "A", "NAME OF THE STUDENT": "YASWANTH RAJ", "SURNAME": "BANDELA", "PEN NO": "20287071701", "AADHAAR NO": "683755948507", "FATHER NAME": "KISHORE", "MOTHER NAME": "SALOMI", "R.NO": "1", "ADMIN NO": "2024", "CASTE": "SC", "SUB CASTE": "MADIGA", "DOB": "12/7/2015", "VILLAGE": "AKKAPALEM", "MOBILE": "6301992094", "EXTRA CELL NO": "", "HOSTEL": "", "H.NO": "1-12/A"},
        {"SECTION": "A", "NAME OF THE STUDENT": "BHANU PRASAD NAIK", "SURNAME": "DHANAVATHU", "PEN NO": "20287071702", "AADHAAR NO": "990231527098", "FATHER NAME": "HARINATHA RAO NAIK", "MOTHER NAME": "HARINI BAI", "R.NO": "2", "ADMIN NO": "2197", "CASTE": "ST", "SUB CASTE": "SUGALI", "DOB": "9/14/2014", "VILLAGE": "SUTHAKUNTA THANDA", "MOBILE": "9890082035", "EXTRA CELL NO": "", "HOSTEL": "", "H.NO": "2-45"},
        {"SECTION": "A", "NAME OF THE STUDENT": "SIVA TEJA NAIK", "SURNAME": "DHANAVATHU", "PEN NO": "20287071703", "AADHAAR NO": "510008088591", "FATHER NAME": "BALU NAIK", "MOTHER NAME": "LALITHA BAI", "R.NO": "3", "ADMIN NO": "2289", "CASTE": "ST", "SUB CASTE": "SUGALI", "DOB": "9/21/2015", "VILLAGE": "SUDDAKURAVA THANDA", "MOBILE": "7569632676", "EXTRA CELL NO": "", "HOSTEL": "", "H.NO": "3-89"},
        {"SECTION": "A", "NAME OF THE STUDENT": "PAVAN KUMAR", "SURNAME": "CHALLA", "PEN NO": "20287071704", "AADHAAR NO": "437043571296", "FATHER NAME": "VENKATA RAMA RAO", "MOTHER NAME": "PADMAVATHI", "R.NO": "4", "ADMIN NO": "1699", "CASTE": "BC-A", "SUB CASTE": "VADDERA", "DOB": "13-04-2014", "VILLAGE": "VENKATA REDDY PALLI", "MOBILE": "8790082108", "EXTRA CELL NO": "", "HOSTEL": "", "H.NO": "12-4"},
        {"SECTION": "A", "NAME OF THE STUDENT": "JAYADEV", "SURNAME": "CHEGURI", "PEN NO": "20287071705", "AADHAAR NO": "696766348402", "FATHER NAME": "VENKATESH", "MOTHER NAME": "MARIYAMMA", "R.NO": "5", "ADMIN NO": "1800", "CASTE": "BC", "SUB CASTE": "VADDERA", "DOB": "10/12/2014", "VILLAGE": "TEKKALAGADAPALEM", "MOBILE": "9866931079", "EXTRA CELL NO": "", "HOSTEL": "H-08", "H.NO": "8-1"},
        {"SECTION": "B", "NAME OF THE STUDENT": "SIVA BALA NAIK", "SURNAME": "DEVASOTH", "PEN NO": "20287071706", "AADHAAR NO": "245586415050", "FATHER NAME": "HANUMANTHU NAIK", "MOTHER NAME": "ANITHA BAI", "R.NO": "6", "ADMIN NO": "2186", "CASTE": "ST", "SUB CASTE": "SUGALI", "DOB": "11/16/2014", "VILLAGE": "CHINNA PBC THANDA", "MOBILE": "9603555316", "EXTRA CELL NO": "", "HOSTEL": "", "H.NO": ""},
        {"SECTION": "G", "NAME OF THE STUDENT": "KAVYA", "SURNAME": "KUNSETTY", "PEN NO": "20287071707", "AADHAAR NO": "659016860357", "FATHER NAME": "KONDAIAH", "MOTHER NAME": "VENKAMMA", "R.NO": "12", "ADMIN NO": "1522", "CASTE": "BC", "SUB CASTE": "NAIDU", "DOB": "26-10-2014", "VILLAGE": "SATHAKODU", "MOBILE": "6303316951", "EXTRA CELL NO": "", "HOSTEL": "HOSTEL", "H.NO": ""}
    ]
    file_bytes = generate_excel_template(headers, sample_rows, sheet_name="Siddardha_Students_Template")
    return Response(
        content=file_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=siddardha_students_import_template.xlsx"}
    )


async def _resolve_section_from_row(
    raw_row: dict,
    academic_year_id: str,
    db: AsyncSession,
    class_id: str | None = None
) -> tuple[str | None, str | None]:
    """
    Parses class (e.g. 1 to 12, Nursery, LKG, UKG) and section (A, B, G, etc.) from row or sheet name.
    Dynamically creates SchoolClass and Section in the database if missing.
    Returns (section_id, section_name).
    """
    import re
    from app.models import SchoolClass, Section
    from sqlalchemy import or_

    # 1. If explicit class_id passed from frontend dropdown
    if class_id and class_id not in ("null", "undefined", ""):
        school_class = await db.get(SchoolClass, class_id)
        if school_class:
            section_val = ""
            for k, v in raw_row.items():
                if not k or str(k).startswith("_"):
                    continue
                k_norm = "".join(ch.lower() for ch in str(k) if ch.isalnum())
                if k_norm in ("section", "onlinesection", "sec"):
                    section_val = str(v).strip().upper()

            sheet_name = str(raw_row.get("_sheet_name", "")).strip().upper()
            sec_match = re.search(r'([A-Za-z])', section_val or sheet_name)
            sec_let = sec_match.group(1).upper() if sec_match else "A"

            sec_query = await db.execute(
                select(Section).where(
                    Section.class_id == school_class.id,
                    Section.name.ilike(sec_let)
                )
            )
            section = sec_query.scalars().first()
            if not section:
                section = Section(class_id=school_class.id, name=sec_let)
                db.add(section)
                await db.flush()
            return section.id, section.name

    # 2. Dynamic class and section detection from row values & sheet name
    class_val = ""
    section_val = ""
    for k, v in raw_row.items():
        if not k or str(k).startswith("_"):
            continue
        k_norm = "".join(ch.lower() for ch in str(k) if ch.isalnum())
        if k_norm in ("class", "grade", "standard", "std", "onlineclass", "cls"):
            class_val = str(v).strip()
        elif k_norm in ("section", "onlinesection", "sec"):
            section_val = str(v).strip()

    sheet_name = str(raw_row.get("_sheet_name", "")).strip()

    cls_num = ""
    sec_let = ""

    # Check if sheet_name is generic like "Sheet19", "Sheet20", "Sheet1"
    is_generic_sheet = bool(re.match(r'^sheet\s*\d+$', sheet_name, re.IGNORECASE))

    # Match sheet name patterns like "6A", "6-B", "Class 6G", "10G", "10-A"
    if not is_generic_sheet:
        match = re.search(r'(\d{1,2}|nursery|lkg|ukg)\s*[-_]?\s*([a-zA-Z])', sheet_name, re.IGNORECASE)
        if match:
            cls_num = match.group(1).upper()
            sec_let = match.group(2).upper()

    if not cls_num:
        match_cls = re.search(r'(\d{1,2}|nursery|lkg|ukg)', class_val or (sheet_name if not is_generic_sheet else ""), re.IGNORECASE)
        match_sec = re.search(r'([a-zA-Z])', section_val or "")
        if match_cls:
            cls_num = match_cls.group(1).upper()
        if match_sec:
            sec_let = match_sec.group(1).upper()

        if not sec_let and class_val:
            match_both = re.search(r'(\d{1,2}|nursery|lkg|ukg)\s*[-_]?\s*([a-zA-Z])', class_val, re.IGNORECASE)
            if match_both:
                cls_num = match_both.group(1).upper()
                sec_let = match_both.group(2).upper()

    # Reject grade numbers > 12 (e.g., 19, 20, 21 from Sheet19, Sheet20)
    if cls_num.isdigit() and int(cls_num) > 12:
        cls_num = ""

    if not sec_let:
        sec_let = "A"

    if not cls_num:
        cls_num = "10"  # Safe default class if unspecified in file

    cls_name_search = f"Class {cls_num}" if cls_num.isdigit() else cls_num

    cls_query = await db.execute(
        select(SchoolClass).where(
            or_(
                SchoolClass.academic_year_id == academic_year_id,
                SchoolClass.academic_year_id == str(academic_year_id)
            ),
            or_(
                SchoolClass.name.ilike(f"%{cls_num}%"),
                SchoolClass.name.ilike(cls_name_search)
            )
        )
    )
    school_class = cls_query.scalars().first()

    if not school_class:
        fallback_cls = await db.execute(
            select(SchoolClass).where(
                or_(
                    SchoolClass.name.ilike(f"%{cls_num}%"),
                    SchoolClass.name.ilike(cls_name_search)
                )
            )
        )
        school_class = fallback_cls.scalars().first()

    if not school_class:
        school_class = SchoolClass(
            name=cls_name_search,
            academic_year_id=str(academic_year_id)
        )
        db.add(school_class)
        await db.flush()

    sec_query = await db.execute(
        select(Section).where(
            Section.class_id == school_class.id,
            or_(
                Section.name.ilike(sec_let),
                Section.name.ilike(f"Section {sec_let}"),
                Section.name.ilike(f"Sec {sec_let}")
            )
        )
    )
    section = sec_query.scalars().first()
    if not section:
        section = Section(class_id=school_class.id, name=sec_let)
        db.add(section)
        await db.flush()

    return section.id, section.name


@router.post("/bulk-import")
async def bulk_import(
    file: UploadFile = File(...),
    academic_year_id: UUID = Form(...),
    section_id: str | None = Form(None),
    class_id: str | None = Form(None),
    _: User = Depends(require_permission("students:create")),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    import re
    from app.models import Parent

    filename = file.filename or ""
    if not filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Only Excel (.xlsx, .xls) and CSV (.csv) files are supported.")

    content = await file.read()
    rows = parse_excel_or_csv(content, filename)

    if not rows:
        raise HTTPException(status_code=400, detail="No readable rows found in the uploaded file.")

    parsed_section_id = None
    parsed_section_name = None
    if section_id and section_id not in ("null", "undefined", ""):
        try:
            parsed_section_id = UUID(section_id)
            sec_obj = await db.get(Section, str(parsed_section_id))
            if sec_obj:
                parsed_section_name = sec_obj.name
        except ValueError:
            pass

    parsed_class_id = None
    if class_id and class_id not in ("null", "undefined", ""):
        parsed_class_id = class_id

    imported_count = 0
    errors = []

    for row_idx, raw_row in enumerate(rows, start=1):
        try:
            norm_row = {_normalize_header(k): (str(v).strip() if v is not None else "") for k, v in raw_row.items() if k}

            def get_val(*aliases: str) -> str:
                for a in aliases:
                    na = _normalize_header(a)
                    if na in norm_row and norm_row[na]:
                        return norm_row[na]
                return ""

            # Standard Siddardha High School layout extraction
            adm_num = get_val(
                "ADMIN NO", "ADMIN_NO", "Admin No", "Admission Number", "Admission No", "AdmissionNum", "Admission_No", "AdmNo",
                "PEN NO", "PEN_NO", "PEN", "Student ID", "ID", "S.No", "SNo", "Registration No", "Reg No"
            )
            pen_no = get_val("PEN NO", "PEN_NO", "PEN", "Pen Number")
            first_name = get_val(
                "NAME OF THE STUDENT", "NAME OF STUDENT", "Student Name", "Name",
                "First Name", "FirstName", "First_Name", "Full Name", "Student",
                "Candidate Name", "Child Name", "Name in Full"
            )
            middle_name = get_val("Middle Name", "MiddleName", "Middle_Name")
            last_name = get_val("Surname", "Last Name", "LastName", "Last_Name", "Family Name", "Initial")
            father_name = get_val("Father Name", "Father_Name", "Father", "Father's Name", "FATHER NAME")
            mother_name = get_val("Mother Name", "Mother_Name", "Mother", "Mother's Name", "MOTHER NAME")
            dob_val = get_val("DOB", "Date of Birth", "DateOfBirth", "Birth Date", "BirthDate")
            gender_val = get_val("Gender", "Sex")

            sheet_name = str(raw_row.get("_sheet_name") or "").upper()

            sec_id_str = None
            sec_name_found = None

            if parsed_section_id:
                sec_id_str = str(parsed_section_id)
                sec_name_found = parsed_section_name
            else:
                sec_id_str, sec_name_found = await _resolve_section_from_row(
                    raw_row, str(academic_year_id), db, class_id=parsed_class_id
                )

            # Infer gender if not explicitly given
            if not gender_val or gender_val.upper() in ("A", "B", "G"):
                if (sec_name_found and sec_name_found.upper() == "G") or "-G" in sheet_name or "GIRL" in sheet_name:
                    gender_val = "Female"
                elif (sec_name_found and sec_name_found.upper() in ("A", "B")) or "-A" in sheet_name or "-B" in sheet_name or "BOY" in sheet_name:
                    gender_val = "Male"

            # Clean leading index/serial numbers from first_name (e.g. "1. Rahul Kumar" -> "Rahul Kumar")
            if first_name:
                first_name = re.sub(r'^\d+[\.\s\)-]+', '', first_name).strip()

            # Handle full name splitting if last_name is missing
            if first_name and (not last_name or last_name == "."):
                parts = first_name.split()
                if len(parts) >= 2:
                    first_name = parts[0]
                    last_name = " ".join(parts[1:])
                elif len(parts) == 1:
                    first_name = parts[0]
                    last_name = "."

            # Auto generate admission number if missing (prefer ADMIN NO over PEN NO)
            if not adm_num:
                if pen_no:
                    adm_num = pen_no
                else:
                    adm_num = f"ADM{date.today().year}{row_idx:04d}"

            if not first_name:
                continue

            if not last_name:
                last_name = "."

            # Ensure unique admission number
            existing = await db.execute(
                select(Student).where(
                    Student.admission_number == adm_num,
                    Student.is_deleted.is_(False)
                )
            )
            if existing.scalar_one_or_none():
                adm_num = f"{adm_num}_{row_idx}"
                existing_retry = await db.execute(
                    select(Student).where(
                        Student.admission_number == adm_num,
                        Student.is_deleted.is_(False)
                    )
                )
                if existing_retry.scalar_one_or_none():
                    adm_num = f"{adm_num}_{uuid.uuid4().hex[:4]}"

            dob = _safe_date(dob_val) or date(2015, 1, 1)
            gender = _safe_gender(gender_val)
            category = _safe_category(get_val("Caste", "Category", "Sub Caste", "Caste Category", "Social Status"))

            phone = get_val("Mobile", "Phone", "Phone Number", "Contact", "Mobile No")
            ext_cell = get_val("Extra Cell No", "Extra Cell", "Extra Mobile", "Alternate Phone", "Alt Mobile", "Alt Phone")
            village = get_val("Village", "Address Line 1", "Address", "Street Address")
            house_no = get_val("H.NO", "H NO", "HNO", "House No", "House Number", "Address Line 2")

            student = Student(
                admission_number=adm_num,
                academic_year_id=str(academic_year_id),
                first_name=first_name,
                middle_name=middle_name or None,
                last_name=last_name,
                date_of_birth=dob,
                gender=gender,
                section_id=sec_id_str,
                roll_number=get_val("Roll Number", "Roll No", "Roll", "R.NO", "R. NO", "RNO") or None,
                phone=phone or None,
                email=get_val("Email", "Email Address") or None,
                category=category,
                blood_group=get_val("Blood Group", "Blood") or None,
                nationality=get_val("Nationality") or "Indian",
                religion=get_val("Religion") or None,
                aadhaar_number=get_val("Aadhaar No", "Aadhaar Number", "Aadhaar", "Adhar No", "Adhar") or None,
                previous_school=get_val("Previous School", "Prev School") or None,
                tc_number=get_val("TC Number", "TC No") or None,
                address_line1=village or None,
                address_line2=house_no or None,
                city=get_val("City") or None,
                state=get_val("State") or None,
                pincode=get_val("Pincode", "Zip", "ZipCode", "Pin") or None,
                alternate_phone=ext_cell or None,
            )
            db.add(student)
            await db.flush()

            # Create Father & Mother records if provided in Excel sheet
            if father_name:
                father_parent = Parent(
                    student_id=student.id,
                    relation="father",
                    first_name=father_name,
                    last_name=last_name if last_name != "." else "",
                    phone=phone or "",
                    is_primary_contact=True,
                )
                db.add(father_parent)

            if mother_name:
                mother_parent = Parent(
                    student_id=student.id,
                    relation="mother",
                    first_name=mother_name,
                    last_name=last_name if last_name != "." else "",
                    phone=ext_cell or phone or "",
                    is_primary_contact=False if father_name else True,
                )
                db.add(mother_parent)

            imported_count += 1

            # Batch flush every 50 records for high performance with 500+ records
            if imported_count % 50 == 0:
                await db.flush()

        except Exception as e:
            errors.append(f"Row {row_idx}: Error processing row ({e})")

    await db.flush()
    return success_response(
        data={"imported": imported_count, "errors": errors},
        message=f"Successfully imported {imported_count} students with {len(errors)} errors."
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

    from datetime import timezone
    student.is_deleted = True
    student.deleted_by = str(user.id)
    student.deleted_at = datetime.now(timezone.utc)
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
    url = upload_file(content, key, file.content_type or "application/octet-stream")

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
    url = upload_file(content, key, file.content_type or "application/octet-stream")

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
