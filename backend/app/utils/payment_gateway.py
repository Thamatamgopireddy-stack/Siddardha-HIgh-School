import hmac
import hashlib
import uuid
import logging
from typing import Dict, Any

logger = logging.getLogger("educore")

# Mock or live Razorpay payment gateway integration helper
RAZORPAY_ENABLED = False  # Set to True when live RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET are provided in environment


def create_razorpay_order(amount: float, currency: str = "INR", receipt_id: str = None) -> Dict[str, Any]:
    """
    Creates a payment order for online payment gateway (Razorpay standard).
    If RAZORPAY_ENABLED is False, generates a clean mock order structure.
    """
    order_receipt = receipt_id or f"rcpt_{uuid.uuid4().hex[:10]}"
    amount_in_paise = int(round(amount * 100))

    if RAZORPAY_ENABLED:
        try:
            import razorpay
            from app.core.config import settings
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            data = {"amount": amount_in_paise, "currency": currency, "receipt": order_receipt}
            order = client.order.create(data=data)
            return {
                "id": order["id"],
                "amount": order["amount"],
                "currency": order["currency"],
                "receipt": order["receipt"],
                "status": order["status"],
            }
        except Exception as e:
            logger.error(f"Razorpay order creation error: {e}")
            raise RuntimeError(f"Payment gateway error: {e}")

    # Scaffold / Mock Order Response
    mock_order_id = f"order_{uuid.uuid4().hex[:14]}"
    logger.info(f"Generated scaffold payment gateway order: {mock_order_id} for amount {amount}")
    return {
        "id": mock_order_id,
        "amount": amount_in_paise,
        "currency": currency,
        "receipt": order_receipt,
        "status": "created",
        "mock": True,
    }


def verify_razorpay_signature(order_id: str, payment_id: str, signature: str, secret: str = "mock_secret") -> bool:
    """
    Verifies Razorpay payment signature authenticity.
    """
    if RAZORPAY_ENABLED:
        try:
            import razorpay
            from app.core.config import settings
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            params_dict = {
                'razorpay_order_id': order_id,
                'razorpay_payment_id': payment_id,
                'razorpay_signature': signature
            }
            client.utility.verify_payment_signature(params_dict)
            return True
        except Exception as e:
            logger.error(f"Razorpay signature verification failed: {e}")
            return False

    # Mock signature verification logic for testing/scaffold
    generated_signature = hmac.new(
        secret.encode('utf-8'),
        f"{order_id}|{payment_id}".encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature == generated_signature or signature == "mock_valid_signature"
