import logging
import json
from typing import Dict, List, Set, Any
from fastapi import WebSocket

logger = logging.getLogger("siddardha.websocket")


class ConnectionManager:
    def __init__(self):
        # Maps user_id -> Set[WebSocket]
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        # Maps role -> Set[WebSocket]
        self.role_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str, role: str):
        await websocket.accept()
        
        # Track by user_id
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

        # Track by role
        if role not in self.role_connections:
            self.role_connections[role] = set()
        self.role_connections[role].add(websocket)

        logger.info(f"WebSocket client connected: user={user_id}, role={role}. Total active users={len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket, user_id: str, role: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        if role in self.role_connections:
            self.role_connections[role].discard(websocket)
            if not self.role_connections[role]:
                del self.role_connections[role]

        logger.info(f"WebSocket client disconnected: user={user_id}")

    async def send_personal_message(self, message: Dict[str, Any], user_id: str):
        if user_id in self.active_connections:
            payload = json.dumps(message)
            dead_sockets = set()
            for ws in list(self.active_connections[user_id]):
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning(f"Failed to send WS message to user {user_id}: {e}")
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.active_connections[user_id].discard(ws)

    async def broadcast_to_role(self, message: Dict[str, Any], role: str):
        if role in self.role_connections:
            payload = json.dumps(message)
            dead_sockets = set()
            for ws in list(self.role_connections[role]):
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning(f"Failed to send WS message to role {role}: {e}")
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                self.role_connections[role].discard(ws)

    async def broadcast_to_all(self, message: Dict[str, Any]):
        payload = json.dumps(message)
        for user_id, sockets in list(self.active_connections.items()):
            dead_sockets = set()
            for ws in list(sockets):
                try:
                    await ws.send_text(payload)
                except Exception as e:
                    logger.warning(f"Failed to broadcast WS message: {e}")
                    dead_sockets.add(ws)
            for ws in dead_sockets:
                sockets.discard(ws)


# Global singleton instance
ws_manager = ConnectionManager()
