import io
import csv
import logging
from datetime import date
from typing import Any, Callable, Dict, List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Student, Staff, User
from app.core.enums import Category, Gender

logger = logging.getLogger("educore")


class FieldSpec:
    def __init__(
        self,
        csv_header: str,
        model_attr: str,
        required: bool = False,
        field_type: str = "string",
        converter: Optional[Callable[[str], Any]] = None,
        default: Any = None
    ):
        self.csv_header = csv_header
        self.model_attr = model_attr
        self.required = required
        self.field_type = field_type
        self.converter = converter
        self.default = default


class EntityImportConfig:
    def __init__(
        self,
        model_class: Any,
        unique_fields: List[str],
        fields: List[FieldSpec],
        entity_name: str
    ):
        self.model_class = model_class
        self.unique_fields = unique_fields
        self.fields = fields
        self.entity_name = entity_name


# Pre-configured converters
def parse_date(val: str) -> date:
    return date.fromisoformat(val.strip())

def parse_gender(val: str) -> Gender:
    return Gender(val.strip().lower())

def parse_category(val: str) -> Optional[Category]:
    s = val.strip().lower()
    return Category(s) if s else None


# 1. STUDENT IMPORT CONFIG
STUDENT_IMPORT_CONFIG = EntityImportConfig(
    model_class=Student,
    unique_fields=["admission_number"],
    entity_name="Student",
    fields=[
        FieldSpec("Admission Number", "admission_number", required=True),
        FieldSpec("First Name", "first_name", required=True),
        FieldSpec("Middle Name", "middle_name", required=False),
        FieldSpec("Last Name", "last_name", required=True),
        FieldSpec("Date of Birth", "date_of_birth", required=True, converter=parse_date),
        FieldSpec("Gender", "gender", required=True, converter=parse_gender),
        FieldSpec("Roll Number", "roll_number", required=False),
        FieldSpec("Phone", "phone", required=False),
        FieldSpec("Email", "email", required=False),
        FieldSpec("Category", "category", required=False, converter=parse_category),
        FieldSpec("Blood Group", "blood_group", required=False),
        FieldSpec("Nationality", "nationality", required=False, default="Indian"),
        FieldSpec("Religion", "religion", required=False),
        FieldSpec("Aadhaar Number", "aadhaar_number", required=False),
        FieldSpec("Address Line 1", "address_line1", required=False),
        FieldSpec("City", "city", required=False),
        FieldSpec("State", "state", required=False),
        FieldSpec("Pincode", "pincode", required=False),
    ]
)

# 2. TEACHER / STAFF IMPORT CONFIG
TEACHER_IMPORT_CONFIG = EntityImportConfig(
    model_class=Staff,
    unique_fields=["employee_id"],
    entity_name="Teacher",
    fields=[
        FieldSpec("Employee ID", "employee_id", required=True),
        FieldSpec("Department", "department", required=False, default="General"),
    ]
)


async def execute_generic_bulk_import(
    file_bytes: bytes,
    filename: str,
    config: EntityImportConfig,
    db: AsyncSession,
    dry_run: bool = True,
    extra_kwargs: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    if not filename.endswith(".csv"):
        raise ValueError("Only CSV files are supported for bulk import.")

    decoded = file_bytes.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    total_rows = 0
    valid_count = 0
    invalid_count = 0
    errors = []
    valid_preview_items = []
    objects_to_commit = []

    seen_unique_keys: Dict[str, set] = {uf: set() for uf in config.unique_fields}

    for row_idx, row in enumerate(reader, start=1):
        total_rows += 1
        row_errors = []
        parsed_attrs = {}
        row_identifier = f"Row {row_idx}"

        # 1. Required field checks & type conversion
        for fspec in config.fields:
            raw_val = row.get(fspec.csv_header, "").strip() if row.get(fspec.csv_header) else ""

            if fspec.model_attr in config.unique_fields and raw_val:
                row_identifier = f"Row {row_idx} ({raw_val})"

            if fspec.required and not raw_val:
                row_errors.append(f"Missing required field '{fspec.csv_header}'")
                continue

            if not raw_val:
                parsed_attrs[fspec.model_attr] = fspec.default
                continue

            if fspec.converter:
                try:
                    parsed_attrs[fspec.model_attr] = fspec.converter(raw_val)
                except Exception as e:
                    row_errors.append(f"Invalid value for '{fspec.csv_header}' ({e})")
            else:
                parsed_attrs[fspec.model_attr] = raw_val

        # 2. Duplicate Key Checks (In-batch & Database)
        if not row_errors:
            for ufield in config.unique_fields:
                uval = parsed_attrs.get(ufield)
                if uval:
                    # In-batch duplicate check
                    if uval in seen_unique_keys[ufield]:
                        row_errors.append(f"Duplicate {ufield.replace('_', ' ')} '{uval}' within the uploaded file.")
                        break
                    seen_unique_keys[ufield].add(uval)

                    # Database duplicate check
                    model_attr_obj = getattr(config.model_class, ufield)
                    is_del_obj = getattr(config.model_class, "is_deleted", None)

                    query = select(config.model_class).where(model_attr_obj == uval)
                    if is_del_obj is not None:
                        query = query.where(is_del_obj.is_(False))

                    existing = (await db.execute(query)).scalar_one_or_none()
                    if existing:
                        row_errors.append(f"{config.entity_name} with {ufield.replace('_', ' ')} '{uval}' already exists in database.")
                        break

        if row_errors:
            invalid_count += 1
            errors.append({
                "row": row_idx,
                "identifier": row_identifier,
                "reason": "; ".join(row_errors),
                "raw_data": row
            })
        else:
            valid_count += 1
            if extra_kwargs:
                parsed_attrs.update(extra_kwargs)

            # If Student entity, dynamically resolve section if Class / Section specified in CSV
            if config.model_class == Student:
                csv_class = (row.get("Class") or row.get("Class Name") or row.get("Standard") or row.get("Grade") or "").strip()
                csv_section = (row.get("Section") or row.get("Section Name") or "").strip()

                if csv_class or csv_section:
                    from app.models.academic import SchoolClass, Section
                    q_sec = select(Section).join(SchoolClass, Section.class_id == SchoolClass.id).where(Section.is_deleted.is_(False))
                    if csv_class:
                        clean_cls = csv_class.lower().replace("class", "").replace("th", "").strip()
                        q_sec = q_sec.where(SchoolClass.name.ilike(f"%{clean_cls}%"))
                    if csv_section:
                        clean_sec = csv_section.lower().replace("section", "").strip()
                        q_sec = q_sec.where(Section.name.ilike(f"%{clean_sec}%"))

                    matched_sec = (await db.execute(q_sec)).scalars().first()
                    if matched_sec:
                        parsed_attrs["section_id"] = matched_sec.id
            
            # If Staff entity, map user_id stub if needed
            if config.model_class == Staff and "user_id" not in parsed_attrs:
                parsed_attrs["user_id"] = extra_kwargs.get("user_id") if extra_kwargs else None

            valid_preview_items.append(parsed_attrs)

            if not dry_run:
                obj = config.model_class(**parsed_attrs)
                objects_to_commit.append(obj)

    # If Confirm Import Mode (dry_run=False), flush and commit valid records
    committed_count = 0
    if not dry_run and objects_to_commit:
        for obj in objects_to_commit:
            try:
                async with db.begin_nested():
                    db.add(obj)
                    await db.flush()
                committed_count += 1
            except Exception as e:
                invalid_count += 1
                valid_count -= 1
                errors.append({
                    "row": getattr(obj, "row_number", "Unknown"),
                    "identifier": f"{config.entity_name}",
                    "reason": f"Database flush error: {e}",
                    "raw_data": {}
                })

    logger.info(f"Generic Bulk Import for {config.entity_name}: total={total_rows}, valid={valid_count}, invalid={invalid_count}, dry_run={dry_run}")

    return {
        "entity_name": config.entity_name,
        "dry_run": dry_run,
        "total_rows": total_rows,
        "valid_count": valid_count if dry_run else committed_count,
        "invalid_count": invalid_count,
        "errors": errors,
        "preview_sample": valid_preview_items[:5] if dry_run else []
    }


def generate_error_report_csv(errors: List[Dict[str, Any]]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Row Number", "Identifier", "Failure Reason", "Raw Row Data"])
    for err in errors:
        raw_str = str(err.get("raw_data", {}))
        writer.writerow([err.get("row"), err.get("identifier"), err.get("reason"), raw_str])
    return output.getvalue()
