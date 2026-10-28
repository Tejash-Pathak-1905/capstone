"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Users, User as UserIcon, LogOut, LogIn, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavbarProps {
  currentTab: "discover" | "chat" | "profile" | "demo";
  onTabChange: (tab: "discover" | "chat" | "profile" | "demo") => void;
}

export function Navbar({ currentTab, onTabChange }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-purple-100 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand identity */}
        <div
          onClick={() => onTabChange("discover")}
          className="flex cursor-pointer items-center gap-2.5 transition hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-md shadow-brand-700/30">
            <Sparkles className="size-5" />
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-zinc-900">
              Nexus Social
            </span>
            <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
              v1.0
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Button
            variant={currentTab === "discover" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTabChange("discover")}
            className="flex items-center gap-1.5"
          >
            <Users className="size-4" />
            <span className="hidden sm:inline">Discover</span>
          </Button>

          <Button
            variant={currentTab === "chat" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTabChange("chat")}
            className="flex items-center gap-1.5"
          >
            <MessageSquare className="size-4" />
            <span className="hidden sm:inline">Live Chat</span>
          </Button>

          <Button
            variant={currentTab === "demo" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTabChange("demo")}
            className="flex items-center gap-1.5"
          >
            <Sparkles className="size-4" />
            <span className="hidden sm:inline">UI Component</span>
          </Button>

          <Button
            variant={currentTab === "profile" ? "default" : "ghost"}
            size="sm"
            onClick={() => onTabChange("profile")}
            className="flex items-center gap-1.5"
          >
            <UserIcon className="size-4" />
            <span className="hidden sm:inline">Profile</span>
          </Button>
        </nav>

        {/* Auth status / actions */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="flex items-center gap-2.5">
              <div className="hidden text-right md:block">
                <p className="text-xs font-semibold text-zinc-900">{user?.name || "User"}</p>
                <p className="text-[10px] text-zinc-500">@{user?.username || "unnamed"}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={logout}
                title="Log out"
                className="h-8 w-8 rounded-full border-zinc-200"
              >
                <LogOut className="size-3.5 text-zinc-600" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/auth/google/token', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        mockUser: {
                          googleId: 'google_local_dev_' + Math.floor(Math.random() * 1000),
                          email: 'dev@nexus.social',
                          name: 'Alex Developer',
                        },
                      }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      window.location.reload();
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
                className="hidden sm:inline-flex rounded-xl border-purple-200 text-xs text-brand-700 bg-brand-50 hover:bg-brand-100"
              >
                <Sparkles className="size-3.5 mr-1 text-brand-700" />
                <span>Dev Login</span>
              </Button>
              <a
                href="/api/auth/google"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-800"
              >
                <LogIn className="size-3.5" />
                <span>Sign in with Google</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
