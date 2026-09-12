import json
import pytest
from app.utils.gsheets import (
    extract_spreadsheet_id,
    get_credentials_info,
    get_service_account_status,
    _sanitize_credentials_dict,
)

def test_extract_spreadsheet_id():
    url = "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0"
    assert extract_spreadsheet_id(url) == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

    raw_id = "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
    assert extract_spreadsheet_id(raw_id) == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

    quoted_id = '"1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"'
    assert extract_spreadsheet_id(quoted_id) == "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"

    empty_id = "   "
    assert extract_spreadsheet_id(empty_id) == ""


def test_sanitize_credentials():
    sample_key = {
        "private_key": "-----BEGIN RSA PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\\n-----END RSA PRIVATE KEY-----"
    }
    sanitized = _sanitize_credentials_dict(sample_key)
    assert "\\n" not in sanitized["private_key"]
    assert "\n" in sanitized["private_key"]


def test_service_account_status_structure():
    status = get_service_account_status()
    assert isinstance(status, dict)
    assert "configured" in status
    assert "client_email" in status
    assert "project_id" in status
    assert "instructions" in status

if __name__ == "__main__":
    test_extract_spreadsheet_id()
    test_sanitize_credentials()
    test_service_account_status_structure()
    print("All Google Sheets unit tests passed!")
