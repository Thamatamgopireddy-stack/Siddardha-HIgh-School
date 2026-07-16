import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import logging
from app.core.config import settings

logger = logging.getLogger("siddardha")

def _send_email_sync(to: str, subject: str, html_body: str, attachments: list | None = None) -> bool:
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning("SMTP is not configured. Skipping sending email.")
        return False

    try:
        msg = MIMEMultipart()
        msg["From"] = f"{settings.SCHOOL_NAME} <{settings.SMTP_USER}>"
        msg["To"] = to
        msg["Subject"] = subject

        msg.attach(MIMEText(html_body, "html"))

        if attachments:
            for attach_path in attachments:
                import os
                if not os.path.exists(attach_path):
                    continue
                with open(attach_path, "rb") as f:
                    part = MIMEApplication(f.read(), Name=os.path.basename(attach_path))
                part['Content-Disposition'] = f'attachment; filename="{os.path.basename(attach_path)}"'
                msg.attach(part)

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_PASSWORD:
                server.starttls()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False

async def send_email(to: str, subject: str, html_body: str, attachments: list | None = None) -> bool:
    return await asyncio.to_thread(_send_email_sync, to, subject, html_body, attachments)
