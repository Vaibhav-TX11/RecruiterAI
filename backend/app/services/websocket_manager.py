from fastapi import WebSocket
from typing import List, Dict


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_info: Dict[WebSocket, str] = {}

    async def connect(self, websocket: WebSocket, user: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.user_info[websocket] = user
        await self.broadcast({"type": "user_connected", "user": user, "total": len(self.active_connections)})

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            user = self.user_info.get(websocket, "Unknown")
            self.active_connections.remove(websocket)
            if websocket in self.user_info:
                del self.user_info[websocket]
            return user
        return None

    async def broadcast(self, message: dict):
        disconnected = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except:
                disconnected.append(conn)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
