"use client";

import React, { useEffect, useState, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageSquare } from "lucide-react";

export interface MessageNotification {
  id: string;
  conversationId: string;
  senderName: string;
  content: string;
}

export interface MessageNotificationToastProps {
  notification: MessageNotification | null;
  onDismiss: () => void;
  onClick: (conversationId: string, senderName: string) => void;
}

export function MessageNotificationToast({
  notification,
  onDismiss,
  onClick,
}: MessageNotificationToastProps) {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notification) return;

    if (isPaused) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // Calm display duration: 7 seconds to read comfortably
    timerRef.current = setTimeout(() => {
      onDismiss();
    }, 7000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification, isPaused, onDismiss]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{
            duration: 0.55,
            ease: [0.16, 1, 0.3, 1], // Gentle, human-centered deceleration curve
          }}
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="fixed top-4 right-4 sm:top-5 sm:right-6 z-50 max-w-sm w-[calc(100vw-32px)] sm:w-84 select-none"
        >
          <div
            onClick={() => onClick(notification.conversationId, notification.senderName)}
            className="group relative overflow-hidden flex items-start gap-3.5 rounded-2xl border border-white/15 bg-slate-900/80 text-white backdrop-blur-2xl p-4 shadow-[0_16px_40px_rgba(15,23,42,0.22)] ring-1 ring-purple-500/15 cursor-pointer hover:border-purple-400/40 hover:bg-slate-900/90 transition-all duration-300"
            role="alert"
            aria-live="polite"
          >
            {/* Sender Avatar with Soft Ambient Glow */}
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-purple-500 text-xs font-bold text-white shadow-md shadow-brand-700/25">
              {(notification.senderName || "U")[0].toUpperCase()}
              {/* Blue circle indicator */}
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-slate-900 ring-1 ring-blue-400/40" />
            </div>

            {/* Notification Text */}
            <div className="min-w-0 flex-1 pr-6 text-left">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-300/90">
                <MessageSquare className="size-3 text-purple-400" />
                <span>New message</span>
                <span className="h-1 w-1 rounded-full bg-slate-500" />
                <span className="text-[10px] text-slate-400 font-mono">Just now</span>
              </div>
              <p className="text-[13px] font-bold text-white font-display truncate mt-0.5 tracking-tight">
                {notification.senderName}
              </p>
              <p className="text-[12px] text-slate-300 font-body truncate mt-0.5 leading-relaxed">
                {notification.content}
              </p>
            </div>

            {/* Dismiss Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              aria-label="Dismiss notification"
              className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white transition-colors duration-200"
            >
              <X className="size-3.5" />
            </button>

            {/* Subtle gentle progress timer bar */}
            <motion.div
              initial={{ scaleX: 1 }}
              animate={{ scaleX: isPaused ? undefined : 0 }}
              transition={{ duration: 7, ease: "linear" }}
              style={{ originX: 0 }}
              className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-purple-500/40 via-brand-500/40 to-blue-500/40 rounded-full"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default MessageNotificationToast;
