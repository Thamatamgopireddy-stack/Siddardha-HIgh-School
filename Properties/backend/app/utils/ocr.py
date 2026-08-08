import base64
import logging
import httpx
from app.core.config import settings

logger = logging.getLogger("siddardha")

async def extract_text_from_image(image_bytes: bytes) -> dict:
    # 1. Try Google Vision API if key is provided
    if settings.GOOGLE_VISION_API_KEY:
        try:
            url = f"https://vision.googleapis.com/v1/images:annotate?key={settings.GOOGLE_VISION_API_KEY}"
            image_content = base64.b64encode(image_bytes).decode("utf-8")
            
            payload = {
                "requests": [
                    {
                        "image": {"content": image_content},
                        "features": [{"type": "TEXT_DETECTION"}]
                    }
                ]
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=10.0)
                if response.status_code == 200:
                    res_json = response.json()
                    responses = res_json.get("responses", [])
                    if responses:
                        text_annotations = responses[0].get("textAnnotations", [])
                        if text_annotations:
                            # The first annotation contains the entire block of text
                            full_text = text_annotations[0].get("description", "")
                            return {
                                "success": True,
                                "text": full_text,
                                "raw": responses[0]
                            }
                logger.warning(f"Google Vision API failed with status {response.status_code}: {response.text}")
        except Exception as e:
            logger.error(f"Error calling Google Vision API: {e}")

    # 2. Try pytesseract locally as secondary fallback
    try:
        import pytesseract  # type: ignore
        from PIL import Image
        import io
        
        image = Image.open(io.BytesIO(image_bytes))
        # Run pytesseract in an async thread to prevent event loop blocking
        import asyncio
        text = await asyncio.to_thread(pytesseract.image_to_string, image)
        return {
            "success": True,
            "text": text,
            "raw": {"engine": "tesseract"}
        }
    except ImportError:
        logger.warning("pytesseract or PIL is not installed. OCR running in mock/demo mode.")
    except Exception as e:
        logger.error(f"pytesseract extraction failed: {e}")

    # 3. Fallback/Mock return for development testing
    return {
        "success": False,
        "text": "OCR Mock Result: Siddardha High School Certificate\nName: Rahul Sharma\nDOB: 12/04/2010\nGender: Male\nFather's Name: Amit Sharma",
        "raw": {"engine": "mock"}
    }
