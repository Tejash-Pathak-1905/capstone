"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { ChatMessages, ChatMessage } from "@/components/ui/chat-messages";
import { MessageSquare, Users, AlertCircle, Search, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ChatPageProps {
  activeConversationId?: string | null;
  initialPeerName?: string;
  onNavigateToDiscover?: () => void;
  unreadConversationIds?: string[];
  onConversationRead?: (conversationId: string) => void;
}

export function ChatPage({
  activeConversationId: propConversationId,
  initialPeerName = "Chat",
  onNavigateToDiscover,
  unreadConversationIds = [],
  onConversationRead,
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
  const [searchTerm, setSearchTerm] = useState("");

  // Sync prop change
  useEffect(() => {
    if (propConversationId) {
      setSelectedConversationId(propConversationId);
      if (onConversationRead) {
        onConversationRead(propConversationId);
      }
    }
  }, [propConversationId, onConversationRead]);

  // Mark selected conversation as read
  useEffect(() => {
    if (selectedConversationId && onConversationRead) {
      onConversationRead(selectedConversationId);
    }
  }, [selectedConversationId, onConversationRead]);

  // Load conversation list without auto-opening any chat
  const loadConversations = useCallback(async () => {
    try {
      const res = await api.getUserConversations();
      if (res.success) {
        setConversations(res.conversations || []);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load conversations");
    }
  }, []);

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
        const incomingId = String(incoming.id || incoming._id);
        setMessages((prev) => {
          // 1. If already in list by exact ID, do not duplicate
          if (prev.some((m) => String(m.id) === incomingId)) {
            return prev;
          }

          // 2. If this is the sender's own message, reconcile optimistic message
          const tempIndex = prev.findIndex(
            (m) =>
              String(m.id).startsWith("temp-") &&
              m.sender === "user" &&
              m.content === incoming.content
          );

          if (tempIndex !== -1) {
            const updated = [...prev];
            updated[tempIndex] = {
              id: incomingId,
              sender: "user",
              content: incoming.content,
              timestamp: incoming.createdAt || new Date().toISOString(),
              variant: "solid",
            };
            return updated;
          }

          // 3. Otherwise append as a new message
          return [
            ...prev,
            {
              id: incomingId,
              sender: incoming.senderId === user?.id ? "user" : "peer",
              content: incoming.content,
              timestamp: incoming.createdAt || new Date().toISOString(),
              variant: "solid",
            },
          ];
        });

        // Update conversation list preview
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversationId
              ? {
                  ...c,
                  lastMessage: {
                    content: incoming.content,
                    text: incoming.content,
                    sentAt: incoming.createdAt,
                  },
                }
              : c
          )
        );
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

    // Optimistically add message with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      sender: "user",
      content,
      timestamp: new Date().toISOString(),
      variant: "solid",
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    // Update conversation sidebar preview immediately
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: {
                content,
                text: content,
                sentAt: new Date().toISOString(),
              },
            }
          : c
      )
    );

    try {
      if (isConnected && recipientId) {
        const res = await sendSocketMessage(selectedConversationId, recipientId, content);
        if (res.success && res.message) {
          const confirmedId = String(res.message.id || res.message._id);
          // Reconcile optimistic message
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === confirmedId)) {
              return prev.filter((m) => m.id !== tempId);
            }
            return prev.map((m) =>
              m.id === tempId
                ? {
                    ...m,
                    id: confirmedId,
                    timestamp: res.message.createdAt || m.timestamp,
                  }
                : m
            );
          });
          return;
        }
      }

      // HTTP Fallback
      const httpRes = await api.sendMessage(selectedConversationId, content);
      if (httpRes.success && httpRes.message) {
        const confirmedId = String(httpRes.message.id || httpRes.message._id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  id: confirmedId,
                  timestamp: httpRes.message.createdAt || m.timestamp,
                }
              : m
          )
        );
      }
    } catch (err: any) {
      // Revert optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      alert(err?.message || "Could not deliver message");
    }
  };

  // Filter conversations by search input
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    const term = searchTerm.toLowerCase();
    return conversations.filter((c) => {
      const title = (c.recipient?.name || c.recipient?.username || "").toLowerCase();
      const last = (c.lastMessage?.content || "").toLowerCase();
      return title.includes(term) || last.includes(term);
    });
  }, [conversations, searchTerm]);

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-12 max-w-5xl mx-auto">
      {/* Conversation Thread Sidebar (Master View) */}
      <div
        className={`md:col-span-5 lg:col-span-4 rounded-3xl border border-purple-100 bg-white/95 backdrop-blur-md p-4 text-left shadow-sm h-[calc(100dvh-180px)] min-h-[460px] md:h-[640px] flex-col ${
          selectedConversationId ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-zinc-100 pb-3 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <MessageSquare className="size-4" />
          </div>
          <h2 className="text-sm font-bold text-zinc-900 font-display">Your Conversations</h2>
          <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-mono font-medium text-brand-700 border border-brand-200">
            {conversations.length}
          </span>
        </div>

        {/* Search Bar for Conversations */}
        <div className="relative mb-3">
          <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search chats..."
            className="w-full rounded-xl bg-zinc-50 pl-8 pr-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none border border-transparent focus:border-brand-300 focus:bg-white transition"
          />
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-600 flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-zinc-400">
              <Users className="size-8 mx-auto mb-2 text-zinc-300" />
              <p className="font-medium text-zinc-700">No conversations yet.</p>
              <p className="mt-1 text-[11px] text-zinc-400">Discover active members to connect!</p>
              {onNavigateToDiscover && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onNavigateToDiscover}
                  className="mt-3 rounded-xl text-xs border-purple-200 hover:bg-brand-50"
                >
                  <Sparkles className="size-3 mr-1 text-brand-700" />
                  Explore Discover
                </Button>
              )}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-zinc-400">
              <p>No chats match "{searchTerm}"</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isCurrent = conv.id === selectedConversationId;
              const isUnread = unreadConversationIds?.includes(conv.id);
              const title = conv.recipient?.name || conv.recipient?.username || "Direct Chat";
              const timestamp = formatTimestamp(conv.lastMessage?.sentAt || conv.updatedAt);
              return (
                <button
                  key={conv.id}
                  onClick={() => {
                    setSelectedConversationId(conv.id);
                    setPeerName(title);
                    if (onConversationRead) {
                      onConversationRead(conv.id);
                    }
                  }}
                  className={`w-full text-left rounded-2xl p-3 transition flex items-center gap-3 ${
                    isCurrent
                      ? "bg-brand-50 text-brand-900 border border-brand-200/90 shadow-xs"
                      : "hover:bg-zinc-50 text-zinc-700 border border-transparent"
                  }`}
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 to-indigo-600 font-bold text-white text-xs shadow-sm shadow-brand-700/20">
                    {title[0].toUpperCase()}
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                    {isUnread && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-500 border-2 border-white ring-1 ring-blue-500/30 animate-pulse" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate leading-tight font-display ${isUnread ? "font-bold text-zinc-950" : "font-semibold text-zinc-800"}`}>
                        {title}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isUnread && (
                          <span className="h-2 w-2 rounded-full bg-blue-500" />
                        )}
                        {timestamp && (
                          <span className="text-[10px] text-zinc-400 font-mono">
                            {timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 font-body ${isUnread ? "font-semibold text-brand-900" : "text-zinc-400"}`}>
                      {conv.lastMessage?.content || "Conversation started"}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Display Window (Detail View) */}
      <div
        className={`flex flex-col ${
          selectedConversationId
            ? "fixed inset-0 z-50 md:relative md:inset-auto md:z-auto bg-white h-[100dvh] md:h-[640px] md:col-span-7 lg:col-span-8 md:rounded-3xl"
            : "hidden md:flex md:col-span-7 lg:col-span-8 md:h-[640px]"
        }`}
      >
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
            onBack={() => setSelectedConversationId(null)}
            onClose={() => setSelectedConversationId(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-purple-100 bg-white/90 backdrop-blur-md p-8 text-center shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-purple-100 text-brand-700 mb-4 shadow-inner">
              <MessageSquare className="size-8" />
            </div>
            <h3 className="text-lg font-bold text-zinc-900 font-display">Your Direct Messages</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-zinc-500 font-body">
              Select a conversation from the left pane to view message history and chat in real-time, or connect with new people on Discover.
            </p>
            {onNavigateToDiscover && (
              <Button
                onClick={onNavigateToDiscover}
                size="sm"
                className="mt-5 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white flex items-center gap-1.5 shadow-sm shadow-brand-700/20 text-xs font-semibold"
              >
                <Users className="size-3.5" />
                <span>Explore Discover</span>
                <ArrowRight className="size-3 ml-0.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatPage;
