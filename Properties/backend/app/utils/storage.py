import os
import boto3
import logging
from botocore.exceptions import NoCredentialsError
from app.core.config import settings

logger = logging.getLogger("siddardha")

# Local uploads fallback directory
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_UPLOADS_DIR = os.path.join(BASE_DIR, "static", "uploads")

if not os.path.exists(LOCAL_UPLOADS_DIR):
    os.makedirs(LOCAL_UPLOADS_DIR, exist_ok=True)

def upload_file(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    # 1. Try S3 upload if settings are provided
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.AWS_S3_BUCKET:
        try:
            s3 = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_REGION
            )
            s3.put_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                ACL="public-read"
            )
            # Form public S3 URL
            url = f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
            logger.info(f"File uploaded to S3: {url}")
            return url
        except NoCredentialsError:
            logger.warning("AWS credentials not found. Falling back to local storage.")
        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}")

    # 2. Local Fallback
    try:
        # Sanitize key for filesystem path compatibility
        safe_key = key.replace("/", os.sep)
        dest_path = os.path.join(LOCAL_UPLOADS_DIR, safe_key)
        
        # Create parent directories if they don't exist
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        with open(dest_path, "wb") as f:
            f.write(file_bytes)
            
        # Form local URL serving path
        url = f"/static/uploads/{key}"
        logger.info(f"File saved to local storage: {url}")
        return url
    except Exception as e:
        logger.error(f"Failed to save file to local storage: {e}")
        raise e
