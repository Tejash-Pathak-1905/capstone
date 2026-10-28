"use client";

import React, { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { Navbar } from "@/components/features/Navbar";
import { OnboardingDialog, OnboardingFormValues } from "@/components/features/OnboardingDialog";
import { DiscoverPage } from "@/pages/DiscoverPage";
import { ChatPage } from "@/pages/ChatPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { DemoPage } from "@/pages/DemoPage";

function MainContent() {
  const { user, completeUserProfile, isLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<"discover" | "chat" | "profile" | "demo">("discover");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState("Chat");

  const handleStartChat = (conversationId: string, recipientName: string) => {
    setActiveChatId(conversationId);
    setPeerName(recipientName);
    setCurrentTab("chat");
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

  // Soft-gate check: Does the user need onboarding?
  const showOnboarding = Boolean(user && user.newUser);

  return (
    <div className="min-h-screen bg-canvas text-zinc-900 flex flex-col font-sans">
      <Navbar currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="container mx-auto max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {currentTab === "discover" && <DiscoverPage onStartChat={handleStartChat} />}
        {currentTab === "chat" && (
          <ChatPage
            activeConversationId={activeChatId}
            initialPeerName={peerName}
          />
        )}
        {currentTab === "profile" && <ProfilePage />}
        {currentTab === "demo" && <DemoPage />}
      </main>

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
        <MainContent />
      </SocketProvider>
    </AuthProvider>
  );
}
