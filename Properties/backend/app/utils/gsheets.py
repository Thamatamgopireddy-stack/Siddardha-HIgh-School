import json
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("siddardha")

def _get_access_token() -> str | None:
    # Authenticate and retrieve token using the service account JSON
    if not settings.GOOGLE_SHEETS_CREDENTIALS_JSON:
        logger.warning("GOOGLE_SHEETS_CREDENTIALS_JSON is not configured.")
        return None
    try:
        # Standard service account JWT token auth flow
        # In a real-world scenario, we can use google-auth to generate tokens,
        # or construct a JWT grant manually.
        # We try importing google-auth first.
        from google.oauth2 import service_account  # type: ignore
        from google.auth.transport.requests import Request  # type: ignore
        
        info = json.loads(settings.GOOGLE_SHEETS_CREDENTIALS_JSON)
        creds = service_account.Credentials.from_service_account_info(
            info, 
            scopes=["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.file"]
        )
        creds.refresh(Request())
        return creds.token
    except ImportError:
        logger.warning("google-auth package is not installed. Google Sheets integration will operate in mock mode.")
        return None
    except Exception as e:
        logger.error(f"Failed to authenticate service account: {e}")
        return None

async def read_sheet(spreadsheet_id: str, range_name: str) -> list[list[str]]:
    token = _get_access_token()
    if not token:
        logger.warning(f"Reading mock sheet range '{range_name}'")
        return []
    
    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}"
        async with httpx.AsyncClient() as client:
            response = await client.get(url, headers={"Authorization": f"Bearer {token}"})
            if response.status_code == 200:
                return response.json().get("values", [])
            else:
                logger.error(f"Sheets API read failed: {response.text}")
    except Exception as e:
        logger.error(f"Error reading from Google Sheets: {e}")
    return []

async def write_sheet(spreadsheet_id: str, range_name: str, values: list[list[str]]) -> bool:
    token = _get_access_token()
    if not token:
        logger.warning(f"Writing mock values to sheet range '{range_name}'")
        return True

    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}"
        async with httpx.AsyncClient() as client:
            response = await client.put(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params={"valueInputOption": "USER_ENTERED"},
                json={"values": values}
            )
            if response.status_code == 200:
                return True
            else:
                logger.error(f"Sheets API write failed: {response.text}")
    except Exception as e:
        logger.error(f"Error writing to Google Sheets: {e}")
    return False

async def append_rows(spreadsheet_id: str, range_name: str, values: list[list[str]]) -> bool:
    token = _get_access_token()
    if not token:
        logger.warning(f"Appending mock values to sheet range '{range_name}'")
        return True

    try:
        url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{range_name}:append"
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
                json={"values": values}
            )
            if response.status_code == 200:
                return True
            else:
                logger.error(f"Sheets API append failed: {response.text}")
    except Exception as e:
        logger.error(f"Error appending to Google Sheets: {e}")
    return False
