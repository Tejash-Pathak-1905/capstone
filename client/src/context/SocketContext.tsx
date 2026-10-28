"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  joinRoom: (conversationId: string) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: (conversationId: string) => void;
  sendSocketMessage: (
    conversationId: string,
    recipientId: string,
    content: string
  ) => Promise<{ success: boolean; message?: any; error?: string }>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect if user is authenticated and has finished onboarding (soft gatekeeper)
    if (!user || user.newUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const socketTarget = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const socketInstance = io(socketTarget, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      autoConnect: true,
      transports: ["websocket", "polling"],
    });

    socketInstance.on("connect", () => {
      setIsConnected(true);
    });

    socketInstance.on("disconnect", () => {
      setIsConnected(false);
    });

    socketInstance.on("connect_error", () => {
      setIsConnected(false);
    });

    socketRef.current = socketInstance;

    return () => {
      socketInstance.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, token]);

  const joinRoom = (conversationId: string): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !isConnected) {
        resolve({ success: false, error: "Socket not connected" });
        return;
      }

      socketRef.current.emit("join_room", { conversationId }, (res: any) => {
        if (res && res.success) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res?.error || "Failed to join room" });
        }
      });
    });
  };

  const leaveRoom = (conversationId: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("leave_room", { conversationId });
    }
  };

  const sendSocketMessage = (
    conversationId: string,
    recipientId: string,
    content: string
  ): Promise<{ success: boolean; message?: any; error?: string }> => {
    return new Promise((resolve) => {
      if (!socketRef.current || !isConnected) {
        resolve({ success: false, error: "Socket not connected" });
        return;
      }

      socketRef.current.emit(
        "send_message",
        { conversationId, recipientId, content },
        (res: any) => {
          if (res && res.success) {
            resolve({ success: true, message: res.message || res.data });
          } else {
            resolve({ success: false, error: res?.message || res?.error || "Send failed" });
          }
        }
      );
    });
  };

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        joinRoom,
        leaveRoom,
        sendSocketMessage,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
