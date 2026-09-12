import os
import re
import json
import base64
import logging
from typing import Any, Tuple, List, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("educore")

# Scopes required for read/write Google Sheets & Drive files
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]


def extract_spreadsheet_id(value: str) -> str:
    """
    Extracts the clean Google Spreadsheet ID from either a raw ID
    or a full Google Sheets URL.
    Example:
      https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
      -> 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
    """
    if not value:
        return ""
    val = value.strip()
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", val)
    if match:
        return match.group(1)
    # Remove any surrounding quotes or slashes
    return val.strip("\"'/ ")


def _find_fallback_credentials_file() -> Optional[str]:
    """Look for standard service account JSON files in backend or project root."""
    candidate_paths = [
        "service_account.json",
        "credentials.json",
        "google_credentials.json",
        os.path.join(os.path.dirname(__file__), "..", "..", "service_account.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "credentials.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "service_account.json"),
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "credentials.json"),
    ]
    for p in candidate_paths:
        if os.path.exists(p) and os.path.isfile(p):
            return os.path.abspath(p)
    return None


def get_credentials_info() -> Tuple[Optional[dict], Optional[str]]:
    """
    Parses and returns the service account credentials dictionary.
    Supports:
    1. Raw JSON string in GOOGLE_SHEETS_CREDENTIALS_JSON
    2. File path in GOOGLE_SHEETS_CREDENTIALS_JSON
    3. Base64-encoded JSON in GOOGLE_SHEETS_CREDENTIALS_JSON
    4. GOOGLE_APPLICATION_CREDENTIALS environment variable
    5. Local fallback service_account.json / credentials.json file
    """
    raw_cfg = (settings.GOOGLE_SHEETS_CREDENTIALS_JSON or "").strip()
    
    # 1. Check if file path was provided in setting
    if raw_cfg and os.path.exists(raw_cfg) and os.path.isfile(raw_cfg):
        try:
            with open(raw_cfg, "r", encoding="utf-8") as f:
                info = json.load(f)
                return _sanitize_credentials_dict(info), None
        except Exception as e:
            return None, f"Failed to read credentials file '{raw_cfg}': {e}"

    # 2. Check if raw_cfg is a JSON string
    if raw_cfg and raw_cfg.startswith("{") and raw_cfg.endswith("}"):
        try:
            info = json.loads(raw_cfg)
            return _sanitize_credentials_dict(info), None
        except Exception as e:
            return None, f"Failed to parse GOOGLE_SHEETS_CREDENTIALS_JSON as JSON: {e}"

    # 3. Check if raw_cfg is base64 encoded JSON
    if raw_cfg and len(raw_cfg) > 50 and not raw_cfg.startswith("{"):
        try:
            decoded = base64.b64decode(raw_cfg).decode("utf-8")
            if decoded.strip().startswith("{"):
                info = json.loads(decoded)
                return _sanitize_credentials_dict(info), None
        except Exception:
            pass  # Not base64, proceed to other checks

    # 4. Check GOOGLE_APPLICATION_CREDENTIALS env var
    google_app_creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if google_app_creds and os.path.exists(google_app_creds) and os.path.isfile(google_app_creds):
        try:
            with open(google_app_creds, "r", encoding="utf-8") as f:
                info = json.load(f)
                return _sanitize_credentials_dict(info), None
        except Exception as e:
            return None, f"Failed to read GOOGLE_APPLICATION_CREDENTIALS file '{google_app_creds}': {e}"

    # 5. Check fallback files in directory
    fallback_file = _find_fallback_credentials_file()
    if fallback_file:
        try:
            with open(fallback_file, "r", encoding="utf-8") as f:
                info = json.load(f)
                return _sanitize_credentials_dict(info), None
        except Exception as e:
            return None, f"Failed to read fallback credentials file '{fallback_file}': {e}"

    if not raw_cfg:
        return None, "GOOGLE_SHEETS_CREDENTIALS_JSON is not configured in .env and no service_account.json file was found."
    
    return None, "Invalid Google Sheets credentials format. Must be a valid JSON string or file path."


def _sanitize_credentials_dict(info: dict) -> dict:
    """Ensure private_key has proper newlines and fields are clean."""
    if isinstance(info, dict) and "private_key" in info:
        pk = info["private_key"]
        if isinstance(pk, str) and "\\n" in pk:
            info["private_key"] = pk.replace("\\n", "\n")
    return info


def get_service_account_status() -> dict:
    """Returns diagnostic status of Google Sheets integration and client email."""
    info, error = get_credentials_info()
    if not info:
        return {
            "configured": False,
            "client_email": None,
            "project_id": None,
            "error": error or "Google Sheets credentials not found.",
            "instructions": "Add your Google Service Account JSON to .env as GOOGLE_SHEETS_CREDENTIALS_JSON or place service_account.json in the backend root.",
        }
    
    client_email = info.get("client_email")
    project_id = info.get("project_id")
    
    return {
        "configured": True,
        "client_email": client_email,
        "project_id": project_id,
        "error": None,
        "instructions": f"Share your Google Sheet with '{client_email}' and grant 'Editor' access.",
    }


def _get_access_token() -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (token, error_message).
    """
    info, error = get_credentials_info()
    if not info:
        return None, error

    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request

        creds = service_account.Credentials.from_service_account_info(
            info,
            scopes=SCOPES
        )
        creds.refresh(Request())
        return creds.token, None
    except ImportError:
        err = "Python 'google-auth' library is not installed. Please install 'google-auth'."
        logger.error(err)
        return None, err
    except Exception as e:
        err = f"Failed to authenticate Google Service Account: {e}"
        logger.error(err)
        return None, err


def _parse_api_error(status_code: int, response_text: str, spreadsheet_id: str, client_email: Optional[str] = None) -> str:
    """Formats Google Sheets API error into an actionable, user-friendly message."""
    email_hint = f" Ensure the spreadsheet is shared with '{client_email}' with Editor permissions." if client_email else ""
    
    if status_code == 403:
        return f"Google Sheets Permission Denied (403):{email_hint}"
    elif status_code == 404:
        return f"Google Spreadsheet Not Found (404): Check that spreadsheet ID '{spreadsheet_id}' is correct."
    elif status_code == 400:
        try:
            err_data = json.loads(response_text)
            msg = err_data.get("error", {}).get("message", response_text)
            return f"Google Sheets Bad Request (400): {msg}"
        except Exception:
            return f"Google Sheets Bad Request (400): {response_text}"
    elif status_code == 401:
        return "Google Sheets Unauthorized (401): Service account token expired or invalid."
    else:
        return f"Google Sheets API Error ({status_code}): {response_text}"


async def ensure_sheet_tab_exists(spreadsheet_id: str, tab_name: str, token: str) -> Tuple[bool, Optional[str]]:
    """
    Checks if a tab/worksheet (e.g. 'Students', 'Fees', 'Attendance') exists in the spreadsheet.
    If it doesn't exist, creates it using batchUpdate AddSheetRequest.
    """
    clean_id = extract_spreadsheet_id(spreadsheet_id)
    headers = {"Authorization": f"Bearer {token}"}
    
    try:
        # 1. Fetch spreadsheet metadata to get existing sheet titles
        meta_url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}?fields=sheets.properties.title"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(meta_url, headers=headers)
            if resp.status_code == 200:
                data = resp.json()
                sheets = data.get("sheets", [])
                existing_titles = [s.get("properties", {}).get("title") for s in sheets]
                
                if tab_name in existing_titles:
                    return True, None
                
                # Tab does not exist -> Create it
                update_url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}:batchUpdate"
                req_body = {
                    "requests": [
                        {
                            "addSheet": {
                                "properties": {
                                    "title": tab_name
                                }
                            }
                        }
                    ]
                }
                create_resp = await client.post(update_url, headers=headers, json=req_body)
                if create_resp.status_code == 200:
                    logger.info(f"Created missing worksheet tab '{tab_name}' in spreadsheet {clean_id}")
                    return True, None
                else:
                    return False, f"Failed to create worksheet tab '{tab_name}': {create_resp.text}"
            else:
                return False, _parse_api_error(resp.status_code, resp.text, clean_id)
    except Exception as e:
        logger.error(f"Error ensuring sheet tab '{tab_name}' exists: {e}")
        return False, str(e)


async def read_sheet(spreadsheet_id: str, range_name: str) -> Tuple[List[List[str]], Optional[str]]:
    """
    Reads rows from the specified Google Sheet range.
    Returns (rows, error_message).
    """
    clean_id = extract_spreadsheet_id(spreadsheet_id)
    if not clean_id:
        return [], "Spreadsheet ID is missing or invalid."

    token, auth_err = _get_access_token()
    if not token:
        return [], auth_err or "Authentication failed."

    info, _ = get_credentials_info()
    client_email = info.get("client_email") if info else None

    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}/values/{range_name}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if response.status_code == 200:
                values = response.json().get("values", [])
                return values, None
            else:
                err = _parse_api_error(response.status_code, response.text, clean_id, client_email)
                logger.error(f"Sheets API read failed: {err}")
                return [], err
    except Exception as e:
        err = f"Network or connection error reading Google Sheet: {e}"
        logger.error(err)
        return [], err


async def write_sheet(
    spreadsheet_id: str,
    range_name: str,
    values: List[List[str]],
    clear_first: bool = True
) -> Tuple[bool, Optional[str]]:
    """
    Writes data to a Google Sheet range. Automatically creates the tab if needed.
    Returns (success, error_message).
    """
    clean_id = extract_spreadsheet_id(spreadsheet_id)
    if not clean_id:
        return False, "Spreadsheet ID is missing or invalid."

    token, auth_err = _get_access_token()
    if not token:
        return False, auth_err or "Authentication failed."

    info, _ = get_credentials_info()
    client_email = info.get("client_email") if info else None

    # Extract tab name if present in range_name (e.g. "Students!A1:H" -> "Students")
    if "!" in range_name:
        tab_name = range_name.split("!")[0].strip("'\"")
        tab_ok, tab_err = await ensure_sheet_tab_exists(clean_id, tab_name, token)
        if not tab_ok:
            return False, tab_err

    try:
        headers = {"Authorization": f"Bearer {token}"}
        async with httpx.AsyncClient(timeout=25.0) as client:
            # Clear range first if requested to remove old leftover rows
            if clear_first:
                clear_url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}/values/{range_name}:clear"
                await client.post(clear_url, headers=headers, json={})

            url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}/values/{range_name}"
            response = await client.put(
                url,
                headers=headers,
                params={"valueInputOption": "USER_ENTERED"},
                json={"values": values}
            )
            if response.status_code == 200:
                return True, None
            else:
                err = _parse_api_error(response.status_code, response.text, clean_id, client_email)
                logger.error(f"Sheets API write failed: {err}")
                return False, err
    except Exception as e:
        err = f"Network or connection error writing to Google Sheet: {e}"
        logger.error(err)
        return False, err


async def append_rows(
    spreadsheet_id: str,
    range_name: str,
    values: List[List[str]]
) -> Tuple[bool, Optional[str]]:
    """
    Appends data rows to a Google Sheet range. Automatically creates the tab if needed.
    Returns (success, error_message).
    """
    clean_id = extract_spreadsheet_id(spreadsheet_id)
    if not clean_id:
        return False, "Spreadsheet ID is missing or invalid."

    token, auth_err = _get_access_token()
    if not token:
        return False, auth_err or "Authentication failed."

    info, _ = get_credentials_info()
    client_email = info.get("client_email") if info else None

    if "!" in range_name:
        tab_name = range_name.split("!")[0].strip("'\"")
        tab_ok, tab_err = await ensure_sheet_tab_exists(clean_id, tab_name, token)
        if not tab_ok:
            return False, tab_err

    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}/values/{range_name}:append"
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
                json={"values": values}
            )
            if response.status_code == 200:
                return True, None
            else:
                err = _parse_api_error(response.status_code, response.text, clean_id, client_email)
                logger.error(f"Sheets API append failed: {err}")
                return False, err
    except Exception as e:
        err = f"Network or connection error appending to Google Sheet: {e}"
        logger.error(err)
        return False, err


async def test_spreadsheet_connection(spreadsheet_id: str) -> Tuple[bool, str, dict]:
    """
    Validates connection and permissions to a specific Google Spreadsheet ID.
    Returns (success, message, metadata).
    """
    clean_id = extract_spreadsheet_id(spreadsheet_id)
    if not clean_id:
        return False, "Please enter a valid Google Spreadsheet ID or URL.", {}

    token, auth_err = _get_access_token()
    if not token:
        return False, auth_err or "Google Service Account is not authenticated.", {}

    info, _ = get_credentials_info()
    client_email = info.get("client_email") if info else None

    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{clean_id}?fields=properties.title,sheets.properties.title"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if resp.status_code == 200:
                data = resp.json()
                title = data.get("properties", {}).get("title", "Untitled")
                sheets = [s.get("properties", {}).get("title") for s in data.get("sheets", [])]
                return True, f"Successfully connected to '{title}'!", {
                    "spreadsheet_id": clean_id,
                    "title": title,
                    "tabs": sheets,
                    "service_account": client_email,
                }
            else:
                err = _parse_api_error(resp.status_code, resp.text, clean_id, client_email)
                return False, err, {"service_account": client_email}
    except Exception as e:
        return False, f"Connection test failed: {e}", {"service_account": client_email}
