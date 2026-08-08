import logging
import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status
from jose import JWTError

from app.core.security import decode_token
from app.services.websocket import ws_manager

logger = logging.getLogger("siddardha.websocket_router")

router = APIRouter(tags=["websocket"])


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    user_id = "anonymous"
    role = "guest"

    # Authenticate token if provided
    if token and token != "null" and token != "undefined":
        try:
            payload = decode_token(token)
            if payload.get("type") == "access":
                user_id = payload.get("sub", "anonymous")
                role = payload.get("role", "guest")
        except Exception as e:
            logger.info(f"WebSocket connecting in guest mode ({e})")

    await ws_manager.connect(websocket, user_id=user_id, role=role)

    # Send initial welcome / handshake packet
    await websocket.send_text(
        json.dumps({
            "type": "connection_established",
            "data": {
                "user_id": user_id,
                "role": role,
                "status": "connected",
                "message": "Real-time communication socket ready"
            }
        })
    )

    try:
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                event_type = payload.get("type")

                if event_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

                elif event_type == "chat_message":
                    # Broadcast chat message to target recipient or role
                    recipient_id = payload.get("recipient_id")
                    recipient_role = payload.get("recipient_role")
                    msg_body = payload.get("body", "")
                    title = payload.get("title", "New Message")

                    packet = {
                        "type": "new_message",
                        "data": {
                            "sender_id": user_id,
                            "sender_role": role,
                            "title": title,
                            "body": msg_body,
                        }
                    }

                    if recipient_id:
                        await ws_manager.send_personal_message(packet, recipient_id)
                    elif recipient_role:
                        await ws_manager.broadcast_to_role(packet, recipient_role)
                    else:
                        await ws_manager.broadcast_to_all(packet)

            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "message": "Invalid JSON format"}))

    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, user_id=user_id, role=role)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket, user_id=user_id, role=role)
