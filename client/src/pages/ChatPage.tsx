"use client";

import React, { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { ChatMessages, ChatMessage } from "@/components/ui/chat-messages";
import { MessageSquare, Users, AlertCircle } from "lucide-react";

export interface ChatPageProps {
  activeConversationId?: string | null;
  initialPeerName?: string;
}

export function ChatPage({
  activeConversationId: propConversationId,
  initialPeerName = "Chat",
}: ChatPageProps) {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom, sendSocketMessage } = useSocket();

  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    propConversationId || null
  );
  const [peerName, setPeerName] = useState(initialPeerName);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync prop change
  useEffect(() => {
    if (propConversationId) {
      setSelectedConversationId(propConversationId);
    }
  }, [propConversationId]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    try {
      const res = await api.getUserConversations();
      if (res.success) {
        setConversations(res.conversations || []);
        if (!selectedConversationId && res.conversations?.length > 0) {
          const first = res.conversations[0];
          setSelectedConversationId(first.id);
          setPeerName(first.recipient?.name || first.recipient?.username || "Chat");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load conversations");
    }
  }, [selectedConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when selectedConversationId changes
  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    setError(null);
    try {
      const res = await api.getConversationMessages(conversationId);
      if (res.success) {
        const formatted: ChatMessage[] = (res.messages || []).map((m: any) => ({
          id: m.id || m._id,
          sender: m.senderId === user?.id ? "user" : "peer",
          content: m.content,
          timestamp: m.createdAt,
          variant: "solid",
        }));
        setMessages(formatted);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load messages");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!selectedConversationId) return;

    loadMessages(selectedConversationId);

    // Join WebSocket room
    if (isConnected) {
      joinRoom(selectedConversationId);
    }

    return () => {
      leaveRoom(selectedConversationId);
    };
  }, [selectedConversationId, isConnected, joinRoom, leaveRoom, loadMessages]);

  // Listen for real-time messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (incoming: any) => {
      if (incoming.conversationId === selectedConversationId) {
        setMessages((prev) => [
          ...prev,
          {
            id: incoming.id || incoming._id || String(Date.now()),
            sender: incoming.senderId === user?.id ? "user" : "peer",
            content: incoming.content,
            timestamp: incoming.createdAt || new Date().toISOString(),
            variant: "solid",
          },
        ]);
      }
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [socket, selectedConversationId, user?.id]);

  // Handle message send (tries WebSocket first, falls back to HTTP REST)
  const handleSendMessage = async (content: string) => {
    if (!selectedConversationId || !user) return;

    // Find recipient id
    const activeConv = conversations.find((c) => c.id === selectedConversationId);
    const recipientId = activeConv?.recipient?.id || activeConv?.participants?.find((p: string) => p !== user.id);

    try {
      if (isConnected && recipientId) {
        const res = await sendSocketMessage(selectedConversationId, recipientId, content);
        if (res.success && res.message) {
          // Socket will broadcast receive_message or we can add optimistically
          setMessages((prev) => [
            ...prev,
            {
              id: res.message.id || `temp-${Date.now()}`,
              sender: "user",
              content,
              timestamp: new Date().toISOString(),
              variant: "solid",
            },
          ]);
          return;
        }
      }

      // HTTP Fallback
      const httpRes = await api.sendMessage(selectedConversationId, content);
      if (httpRes.success && httpRes.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: httpRes.message.id || `temp-${Date.now()}`,
            sender: "user",
            content,
            timestamp: new Date().toISOString(),
            variant: "solid",
          },
        ]);
      }
    } catch (err: any) {
      alert(err?.message || "Could not deliver message");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12 max-w-5xl mx-auto">
      {/* Conversation Thread Sidebar */}
      <div className="md:col-span-4 rounded-3xl border border-purple-100 bg-white p-4 text-left shadow-sm h-[620px] flex flex-col">
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-3">
          <MessageSquare className="size-4 text-brand-700" />
          <h2 className="text-sm font-bold text-zinc-900">Your Conversations</h2>
          <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
            {conversations.length}
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-600 flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-1.5">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              <Users className="size-8 mx-auto mb-2 text-zinc-300" />
              <p>No conversations yet.</p>
              <p className="mt-1 text-[11px]">Go to Discover to start chatting!</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isCurrent = conv.id === selectedConversationId;
              const title = conv.recipient?.name || conv.recipient?.username || "Direct Chat";
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversationId(conv.id);
                    setPeerName(title);
                  }}
                  className={`w-full text-left rounded-2xl p-3 transition flex items-center gap-3 ${
                    isCurrent
                      ? "bg-brand-50 text-brand-900 border border-brand-200/80 shadow-xs"
                      : "hover:bg-zinc-50 text-zinc-700"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 font-bold text-white text-xs">
                    {title[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate leading-tight">{title}</p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      {conv.lastMessage?.content || "Conversation started"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Display Window matching reference */}
      <div className="md:col-span-8 flex flex-col h-[620px]">
        {selectedConversationId ? (
          <ChatMessages
            className="h-full w-full"
            peerName={peerName}
            peerStatus={isConnected ? "Real-time socket connected" : "HTTP polling fallback"}
            messages={messages}
            autoPlay={false}
            interactive={true}
            showReplay={false}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-purple-100 bg-white p-8 text-center shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 mb-3">
              <MessageSquare className="size-6" />
            </div>
            <h3 className="text-base font-semibold text-zinc-900">Select a Conversation</h3>
            <p className="mt-1 max-w-xs text-xs text-zinc-500">
              Pick a conversation from the left, or explore the Discover tab to connect with someone new.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
