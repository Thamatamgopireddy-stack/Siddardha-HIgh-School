import httpx
import logging
from app.core.config import settings

logger = logging.getLogger("siddardha")

async def send_sms(phone: str, message: str) -> bool:
    # 1. Try MSG91 first if API key is provided
    if settings.MSG91_API_KEY:
        try:
            # Clean phone to remove prefix + for MSG91
            clean_phone = phone.lstrip('+')
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://api.msg91.com/api/v5/flow/",
                    headers={
                        "authkey": settings.MSG91_API_KEY,
                        "content-type": "application/json"
                    },
                    json={
                        # MSG91 flow API payload structure
                        "recipients": [
                            {
                                "mobiles": clean_phone,
                                "message": message
                            }
                        ]
                    },
                    timeout=5.0
                )
                if response.status_code == 200:
                    logger.info(f"SMS successfully sent via MSG91 to {phone}")
                    return True
                else:
                    logger.warning(f"MSG91 send failed with status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error sending SMS via MSG91: {e}")

    # 2. Fallback to Twilio
    if settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_FROM_NUMBER:
        try:
            url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={
                        "To": phone,
                        "From": settings.TWILIO_FROM_NUMBER,
                        "Body": message
                    },
                    timeout=5.0
                )
                if response.status_code in (200, 201):
                    logger.info(f"SMS successfully sent via Twilio to {phone}")
                    return True
                else:
                    logger.warning(f"Twilio send failed with status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error sending SMS via Twilio fallback: {e}")

    logger.warning(f"No valid SMS gateway configurations found to send: '{message}' to {phone}")
    return False
