"use client";

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider, useSocket } from "@/context/SocketContext";
import { Navbar } from "@/components/features/Navbar";
import { OnboardingDialog, OnboardingFormValues } from "@/components/features/OnboardingDialog";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { ChatPage } from "@/pages/ChatPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { LoginPage } from "@/pages/LoginPage";
import { TopographyBackground } from "@/components/ui/TopographyBackground";
import {
  MessageNotificationToast,
  MessageNotification,
} from "@/components/features/MessageNotificationToast";

function MainContent() {
  const { user, completeUserProfile, isLoading, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  
  // Resolve initial tab from URL path
  const getInitialTab = (): "discover" | "chat" | "profile" => {
    if (typeof window === "undefined") return "discover";
    const path = window.location.pathname;
    if (path.startsWith("/chat")) return "chat";
    if (path.startsWith("/profile")) return "profile";
    return "discover";
  };

  const [currentTab, setCurrentTab] = useState<"discover" | "chat" | "profile">(getInitialTab);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Chat");
  const [unreadConversationIds, setUnreadConversationIds] = useState<string[]>([]);
  const [notification, setNotification] = useState<MessageNotification | null>(null);

  // Sync tab navigation with browser history
  const handleTabChange = (tab: "discover" | "chat" | "profile") => {
    setCurrentTab(tab);
    if (typeof window !== "undefined") {
      const targetPath = tab === "discover" ? "/" : `/${tab}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, "", targetPath);
      }
    }
  };

  // Listen to browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith("/chat")) {
        setCurrentTab("chat");
      } else if (path.startsWith("/profile")) {
        setCurrentTab("profile");
      } else {
        setCurrentTab("discover");
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Sync URL when authenticated vs unauthenticated
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      // Unauthenticated: user cannot move into the platform
      if (window.location.pathname !== "/login") {
        window.history.replaceState(null, "", "/login");
      }
    } else {
      // Authenticated: user lands on the platform
      if (window.location.pathname === "/login") {
        window.history.replaceState(null, "", "/");
      }
    }
  }, [isLoading, isAuthenticated]);

  // Listen for real-time messages to display notification popup and unread blue circle
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (incoming: any) => {
      // Only notify for messages from other users
      if (incoming.senderId && incoming.senderId !== user?.id) {
        const isCurrentlyViewingChat =
          currentTab === "chat" && activeChatId === incoming.conversationId;

        if (!isCurrentlyViewingChat) {
          // Track unread conversation
          setUnreadConversationIds((prev) =>
            prev.includes(incoming.conversationId)
              ? prev
              : [...prev, incoming.conversationId]
          );

          // Pop up message notification toast
          setNotification({
            id: String(incoming.id || incoming._id || Date.now()),
            conversationId: incoming.conversationId,
            senderName: incoming.senderName || "New message",
            content: incoming.content,
          });
        }
      }
    };

    socket.on("receive_message", handleIncomingMessage);
    return () => {
      socket.off("receive_message", handleIncomingMessage);
    };
  }, [socket, user?.id, currentTab, activeChatId]);

  const handleNotificationClick = (conversationId: string, senderName: string) => {
    setNotification(null);
    setUnreadConversationIds((prev) => prev.filter((id) => id !== conversationId));
    setActiveChatId(conversationId);
    setPeerName(senderName);
    handleTabChange("chat");
  };

  const handleConversationRead = (conversationId: string) => {
    setUnreadConversationIds((prev) => prev.filter((id) => id !== conversationId));
  };

  const handleStartChat = (conversationId: string, recipientName: string) => {
    setActiveChatId(conversationId);
    setPeerName(recipientName);
    handleConversationRead(conversationId);
    handleTabChange("chat");
  };

  const handleOnboardingSubmit = async (values: OnboardingFormValues) => {
    return await completeUserProfile(values);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-700 border-t-transparent" />
          <p className="text-xs font-semibold text-zinc-600">Loading Nexus Social...</p>
        </div>
      </div>
    );
  }

  // Without logging in, the user cannot move into the platform.
  // Display the dedicated Login Page.
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Once authenticated, the user lands on the platform.
  // Soft-gate check: Does the user need onboarding?
  const showOnboarding = Boolean(user && user.newUser);

  return (
    <div className="min-h-screen bg-transparent text-zinc-900 flex flex-col font-sans">
      <Navbar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        hasUnreadMessages={unreadConversationIds.length > 0}
      />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-5 sm:py-8 sm:px-6 pb-24 md:pb-8">
        {currentTab === "discover" && <DiscoverPage onStartChat={handleStartChat} />}
        {currentTab === "chat" && (
          <ChatPage
            activeConversationId={activeChatId}
            initialPeerName={peerName}
            onNavigateToDiscover={() => handleTabChange("discover")}
            unreadConversationIds={unreadConversationIds}
            onConversationRead={handleConversationRead}
          />
        )}
        {currentTab === "profile" && <ProfilePage />}
      </main>

      {/* Floating Message Notification Popup */}
      <MessageNotificationToast
        notification={notification}
        onDismiss={() => setNotification(null)}
        onClick={handleNotificationClick}
      />

      {/* Onboarding Dialog: Prompts immediately if user is marked newUser */}
      <OnboardingDialog
        open={showOnboarding}
        initialName={user?.name || ""}
        onSubmit={handleOnboardingSubmit}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <TopographyBackground />
        <MainContent />
      </SocketProvider>
    </AuthProvider>
  );
}
