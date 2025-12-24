import { useEffect, useState, useCallback } from 'react';
import { getToken } from '../services/auth';

export const useWebSocket = (user = 'HR Manager') => {
  const [ws, setWs] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  useEffect(() => {
    const token = getToken();
    const wsUrl = import.meta.env.VITE_API_URL 
      ? import.meta.env.VITE_API_URL.replace('https://', 'wss://').replace('http://', 'ws://')
      : 'ws://localhost:8000';
    
    const websocket = new WebSocket(
      `${wsUrl}/ws?token=${encodeURIComponent(token || '')}`
    );

    websocket.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setWs(websocket);
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('WebSocket message:', data);
      setLastMessage(data);
    };
    
    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, []);

  const sendMessage = useCallback((message) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }, [ws]);

  return { isConnected, lastMessage, sendMessage };
};
