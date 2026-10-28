"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Users, User as UserIcon, LogOut, Sparkles, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NavbarProps {
  currentTab: "discover" | "chat" | "profile";
  onTabChange: (tab: "discover" | "chat" | "profile") => void;
  hasUnreadMessages?: boolean;
}

export function Navbar({ currentTab, onTabChange, hasUnreadMessages = false }: NavbarProps) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-purple-100 bg-white/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          {/* Brand identity */}
          <div
            onClick={() => onTabChange("discover")}
            className="flex cursor-pointer items-center gap-2.5 transition hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-700 to-indigo-600 text-white shadow-md shadow-brand-700/30">
              <Sparkles className="size-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-zinc-900 font-display">
                Nexus Social
              </span>
              <span className="ml-1.5 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-mono font-medium text-brand-700 border border-brand-200">
                v1.0
              </span>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-1.5">
            <Button
              variant={currentTab === "discover" ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange("discover")}
              className="flex items-center gap-1.5 rounded-xl font-medium"
            >
              <Compass className="size-4" />
              <span>Discover</span>
            </Button>

            <Button
              variant={currentTab === "chat" ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange("chat")}
              className="flex items-center gap-1.5 rounded-xl font-medium"
            >
              <div className="relative flex items-center justify-center">
                <MessageSquare className="size-4" />
                {hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 border border-white ring-1 ring-blue-500/30" />
                )}
              </div>
              <span>Live Chats</span>
            </Button>

            <Button
              variant={currentTab === "profile" ? "default" : "ghost"}
              size="sm"
              onClick={() => onTabChange("profile")}
              className="flex items-center gap-1.5 rounded-xl font-medium"
            >
              <UserIcon className="size-4" />
              <span>Profile</span>
            </Button>
          </nav>

          {/* Auth status / actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Desktop user text */}
            <div className="hidden text-right md:block">
              <p className="text-xs font-bold text-zinc-900 font-display tracking-tight">{user?.name || "User"}</p>
              <p className="text-[11px] font-mono font-medium text-brand-700">@{user?.username || "unnamed"}</p>
            </div>

            {/* Mobile user badge chip */}
            <div
              onClick={() => onTabChange("profile")}
              className="flex md:hidden cursor-pointer items-center gap-2 rounded-full border border-purple-100 bg-brand-50/60 py-1 pl-1 pr-2.5"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white shadow-xs">
                {(user?.name || user?.username || "U")[0]?.toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-zinc-800 max-w-[80px] truncate">
                {user?.name?.split(" ")[0] || "User"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              title="Log out of platform"
              className="flex items-center gap-1.5 rounded-xl border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 px-2.5 sm:px-3"
            >
              <LogOut className="size-3.5 text-zinc-600" />
              <span className="hidden sm:inline text-xs font-medium">Log out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Prominent Mobile Bottom Navigation Bar (Appears on mobile screens) */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around border-t border-purple-100/90 bg-white/95 backdrop-blur-xl px-2 py-2 shadow-[0_-6px_25px_rgba(0,0,0,0.06)]"
      >
        <button
          onClick={() => onTabChange("discover")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-2xl transition-all ${
            currentTab === "discover"
              ? "text-brand-700 font-semibold"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <div
            className={`flex h-8 w-12 items-center justify-center rounded-full transition-all ${
              currentTab === "discover" ? "bg-brand-50 text-brand-700" : "text-zinc-500"
            }`}
          >
            <Compass className="size-5" />
          </div>
          <span className="text-[11px] font-medium leading-none">Discover</span>
        </button>

        <button
          onClick={() => onTabChange("chat")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-2xl transition-all ${
            currentTab === "chat"
              ? "text-brand-700 font-semibold"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <div
            className={`flex h-8 w-12 items-center justify-center rounded-full transition-all ${
              currentTab === "chat" ? "bg-brand-50 text-brand-700" : "text-zinc-500"
            }`}
          >
            <div className="relative flex items-center justify-center">
              <MessageSquare className="size-5" />
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white ring-1 ring-blue-500/30" />
              )}
            </div>
          </div>
          <span className="text-[11px] font-medium leading-none">Chats</span>
        </button>

        <button
          onClick={() => onTabChange("profile")}
          className={`flex flex-col items-center justify-center gap-1 py-1 px-4 rounded-2xl transition-all ${
            currentTab === "profile"
              ? "text-brand-700 font-semibold"
              : "text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <div
            className={`flex h-8 w-12 items-center justify-center rounded-full transition-all ${
              currentTab === "profile" ? "bg-brand-50 text-brand-700" : "text-zinc-500"
            }`}
          >
            <UserIcon className="size-5" />
          </div>
          <span className="text-[11px] font-medium leading-none">Profile</span>
        </button>
      </nav>
    </>
  );
}

export default Navbar;
