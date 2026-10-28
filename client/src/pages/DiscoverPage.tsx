"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, UserPlus, RefreshCw, AlertCircle } from "lucide-react";

export interface DiscoverPageProps {
  onStartChat: (conversationId: string, recipientName: string) => void;
}

export function DiscoverPage({ onStartChat }: DiscoverPageProps) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initiatingId, setInitiatingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getDiscoverUsers();
      if (res.success) {
        // Filter out current user from discover list
        const filtered = (res.users || []).filter((u) => u.id !== currentUser?.id);
        setUsers(filtered);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load discovery feed. Please ensure you are logged in.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [currentUser?.id]);

  const handleMessage = async (recipient: any) => {
    if (currentUser?.newUser) {
      alert("Please complete your onboarding profile first before sending messages.");
      return;
    }

    setInitiatingId(recipient.id);
    try {
      const res = await api.initiateConversation(recipient.id);
      if (res.success && res.conversation) {
        onStartChat(res.conversation.id, recipient.name || recipient.username);
      }
    } catch (err: any) {
      alert(err?.message || "Failed to initiate conversation");
    } finally {
      setInitiatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="rounded-3xl border border-purple-100 bg-gradient-to-br from-white via-white to-brand-50/50 p-6 sm:p-8 text-left shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] text-zinc-900 font-display">
              Discover Connections
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-600 font-body">
              Browse people, explore profiles, and initiate real-time direct chats.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUsers}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-xl border-purple-200 hover:bg-brand-50 text-xs font-semibold"
          >
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh Feed</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 font-body">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Users */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-44 rounded-2xl border border-purple-100 bg-white/80 p-5 animate-pulse backdrop-blur-sm"
            />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-purple-200 bg-white/70 backdrop-blur-sm p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 mb-3">
            <UserPlus className="size-6" />
          </div>
          <h3 className="text-base font-bold text-zinc-900 font-display">No users found</h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500 font-body">
            No other active members found in the discover feed right now. Sign in or invite friends!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((person) => (
            <div
              key={person.id}
              className="group flex flex-col justify-between rounded-3xl border border-purple-100 bg-white/90 backdrop-blur-sm p-5 text-left shadow-sm transition-all hover:border-brand-200 hover:shadow-md"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 to-indigo-600 font-bold text-white shadow-sm shadow-brand-700/20 font-display">
                    {(person.name || person.username || "U")[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-zinc-900 leading-tight font-display tracking-tight">
                      {person.name || "Anonymous User"}
                    </h3>
                    <p className="text-xs text-brand-700 font-mono font-medium tracking-tight">
                      @{person.username || "user"}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-zinc-600 line-clamp-3 font-body">
                  {person.bio || "No bio added yet."}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-end">
                <Button
                  size="sm"
                  onClick={() => handleMessage(person)}
                  disabled={initiatingId === person.id}
                  className="rounded-xl bg-brand-700 hover:bg-brand-800 text-white flex items-center gap-1.5 shadow-sm shadow-brand-700/20"
                >
                  <MessageCircle className="size-3.5" />
                  <span>{initiatingId === person.id ? "Opening..." : "Message"}</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DiscoverPage;
