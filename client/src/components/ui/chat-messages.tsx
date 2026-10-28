"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Send, RotateCcw, X, MessageCircle, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant" | "peer";
  content: string;
  variant?: "solid" | "outline";
  timestamp?: string;
}

export interface ChatMessagesProps {
  messages?: ChatMessage[];
  peerName?: string;
  peerStatus?: string;
  autoPlay?: boolean;
  autoPlayDelay?: number;
  typingDuration?: number;
  showReplay?: boolean;
  interactive?: boolean;
  className?: string;
  onSendMessage?: (content: string) => void | Promise<void>;
  onClose?: () => void;
  onBack?: () => void;
  isExternalTyping?: boolean;
}

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    id: "1",
    sender: "assistant",
    content: "Hey there! Welcome to the platform. Looking to discover people or start chatting?",
  },
  {
    id: "2",
    sender: "user",
    variant: "solid",
    content: "I want to connect with other creators and discuss new projects.",
  },
  {
    id: "3",
    sender: "user",
    variant: "outline",
    content: "Show me who's active today!",
  },
  {
    id: "4",
    sender: "assistant",
    content: "Awesome! Check out the Discover tab, or send messages directly to your connections.",
  },
];

function TypingIndicator({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-zinc-200/60 bg-[#F1F3F5] px-4 py-3 shadow-sm",
        className,
      )}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-2 w-2 rounded-full bg-brand-700/60"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.sender === "user";
  const isOutline = message.variant === "outline";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97, x: isUser ? 16 : -16 }}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div className={cn("relative max-w-[82%]", isUser ? "items-end" : "items-start")}>
        <motion.div
          layout
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-shadow",
            // Reference image styling:
            // Peer message: soft gray bubble with slight tail
            !isUser &&
              "rounded-bl-xs border border-zinc-200/70 bg-[#F1F3F5] text-zinc-900 shadow-sm",
            // User message: solid purple pill
            isUser &&
              !isOutline &&
              "rounded-br-xs bg-brand-700 text-white shadow-md shadow-brand-700/20",
            // User option: white pill with bold purple outline
            isUser &&
              isOutline &&
              "border-2 border-brand-700 bg-white font-medium text-brand-700 shadow-sm",
          )}
          whileHover={{ scale: 1.01 }}
          transition={{ duration: 0.15 }}
        >
          {message.content}
        </motion.div>
        {message.timestamp && (
          <span className="mt-1 block text-[10px] text-zinc-400 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
      </div>
    </motion.div>
  );
}

export function ChatMessages({
  messages = DEFAULT_MESSAGES,
  peerName = "Social Assistant",
  peerStatus = "Active now",
  autoPlay = false,
  autoPlayDelay = 1600,
  typingDuration = 1200,
  showReplay = true,
  interactive = true,
  className,
  onSendMessage,
  onClose,
  onBack,
  isExternalTyping = false,
}: ChatMessagesProps) {
  const [visibleCount, setVisibleCount] = useState(
    autoPlay ? 0 : messages.length,
  );
  const [internalTyping, setInternalTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(messages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoPlaying = useRef(false);

  // Sync external messages prop
  useEffect(() => {
    setChatMessages(messages);
    if (!autoPlay) {
      setVisibleCount(messages.length);
    }
  }, [messages, autoPlay]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, []);

  const revealNext = useCallback(
    async (index: number) => {
      if (index >= chatMessages.length) {
        isAutoPlaying.current = false;
        return;
      }

      const message = chatMessages[index];

      if (message.sender !== "user") {
        setInternalTyping(true);
        await new Promise((r) => setTimeout(r, typingDuration));
        setInternalTyping(false);
      }

      setVisibleCount(index + 1);
      await new Promise((r) => setTimeout(r, 80));
      scrollToBottom();

      await new Promise((r) =>
        setTimeout(
          r,
          autoPlayDelay -
            (message.sender !== "user" ? typingDuration : 0) -
            80,
        ),
      );

      if (isAutoPlaying.current) {
        revealNext(index + 1);
      }
    },
    [chatMessages, autoPlayDelay, typingDuration, scrollToBottom],
  );

  const replay = useCallback(() => {
    setVisibleCount(0);
    setChatMessages(messages);
    isAutoPlaying.current = true;
    setTimeout(() => revealNext(0), 100);
  }, [messages, revealNext]);

  useEffect(() => {
    if (autoPlay) {
      setVisibleCount(0);
      isAutoPlaying.current = true;
      const timer = setTimeout(() => revealNext(0), 400);
      return () => {
        clearTimeout(timer);
        isAutoPlaying.current = false;
      };
    } else {
      setVisibleCount(chatMessages.length);
    }
  }, [autoPlay, revealNext, chatMessages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [visibleCount, internalTyping, isExternalTyping, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || !interactive) return;

    const trimmed = inputValue.trim();
    setInputValue("");

    if (onSendMessage) {
      await onSendMessage(trimmed);
      return;
    }

    // Default internal echo for demo/unconnected mode
    const newMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      variant: "solid",
      content: trimmed,
    };

    setChatMessages((prev) => [...prev, newMessage]);
    setVisibleCount((prev) => prev + 1);

    setTimeout(() => {
      const assistantReply: ChatMessage = {
        id: `peer-${Date.now()}`,
        sender: "assistant",
        content: "Thanks for reaching out! Let's stay in touch.",
      };
      setChatMessages((prev) => [...prev, assistantReply]);
      setVisibleCount((prev) => prev + 1);
    }, typingDuration + 300);
  }, [inputValue, interactive, onSendMessage, typingDuration]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isTyping = internalTyping || isExternalTyping;

  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-3xl border border-purple-100 bg-white shadow-[0_20px_50px_rgba(109,40,217,0.08)]",
        className,
      )}
    >
      {/* Header matching reference: Icon on left, Reload & Close on right */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 sm:px-5 py-3.5 sm:py-4">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {onBack && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onBack}
              title="Back to conversations"
              aria-label="Back to conversations"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
            >
              <ArrowLeft className="size-4" />
            </motion.button>
          )}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-700 shadow-sm shadow-brand-700/20 text-white font-bold text-xs">
            {peerName ? peerName[0].toUpperCase() : <MessageCircle className="h-5 w-5" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 leading-tight">
              {peerName}
            </h3>
            <p className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {peerStatus}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {showReplay && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={replay}
              title="Reset / Replay Conversation"
              aria-label="Replay conversation"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <RotateCcw className="size-4" />
            </motion.button>
          )}
          {onClose && (
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onClose}
              title="Close Chat"
              aria-label="Close chat"
              className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X className="size-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Messages area with light gray scrollbar */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="flex-1 space-y-3.5 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-zinc-300"
      >
        {chatMessages.slice(0, visibleCount).map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <AnimatePresence>{isTyping && <TypingIndicator />}</AnimatePresence>
      </div>

      {/* Input container matching reference image */}
      <div className="border-t border-zinc-100 bg-white p-4">
        {/* Rounded full pill input */}
        <div className="flex items-center gap-2 rounded-full bg-[#F1F3F5] px-4 py-2 transition-all focus-within:ring-2 focus-within:ring-brand-700/20">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!interactive}
            placeholder={
              interactive ? "Type a message..." : "Demo mode - replay to watch"
            }
            aria-label="Type your message"
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
          />
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!interactive || !inputValue.trim()}
            aria-label="Send message"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all",
              interactive && inputValue.trim()
                ? "bg-brand-700 text-white shadow-sm shadow-brand-700/30"
                : "text-zinc-400 hover:text-zinc-600",
            )}
          >
            <Send className="size-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default ChatMessages;
