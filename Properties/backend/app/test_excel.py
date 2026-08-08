import pytest
from app.utils.excel import generate_excel_template, parse_excel_or_csv

def test_excel_template_and_parsing():
    headers = ["Admission Number", "First Name", "Last Name", "Date of Birth", "Gender"]
    sample_rows = [
        {
            "Admission Number": "ADM1001",
            "First Name": "John",
            "Last Name": "Doe",
            "Date of Birth": "2010-01-01",
            "Gender": "male"
        }
    ]
    # Test Excel generation
    excel_bytes = generate_excel_template(headers, sample_rows, sheet_name="Students")
    assert isinstance(excel_bytes, bytes)
    assert len(excel_bytes) > 0

    # Test Excel parsing
    parsed_rows = parse_excel_or_csv(excel_bytes, "test.xlsx")
    assert len(parsed_rows) == 1
    assert parsed_rows[0]["Admission Number"] == "ADM1001"
    assert parsed_rows[0]["First Name"] == "John"
    assert parsed_rows[0]["Last Name"] == "Doe"
    assert parsed_rows[0]["Gender"] == "male"

def test_csv_parsing():
    csv_content = b"Admission Number,First Name,Last Name,Date of Birth,Gender\nADM1002,Jane,Smith,2011-02-02,female"
    parsed_rows = parse_excel_or_csv(csv_content, "test.csv")
    assert len(parsed_rows) == 1
    assert parsed_rows[0]["Admission Number"] == "ADM1002"
    assert parsed_rows[0]["First Name"] == "Jane"
    assert parsed_rows[0]["Gender"] == "female"
