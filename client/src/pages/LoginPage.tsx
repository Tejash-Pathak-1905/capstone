"use client";

import React, { useMemo } from "react";
import { Sparkles, MessageSquare, ShieldCheck, Users, AlertCircle } from "lucide-react";

export function LoginPage() {
  // Read error param if redirected back with error
  const errorMessage = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "oauth_failed") {
      return "Google authentication failed. Please try again.";
    }
    if (err === "auth_required") {
      return "Please sign in with Google to access the platform.";
    }
    if (err) {
      return `Authentication error: ${err}`;
    }
    return null;
  }, []);

  return (
    <div className="min-h-screen bg-transparent flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden font-sans">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-700 text-white shadow-xl shadow-brand-700/35 ring-4 ring-white">
            <Sparkles className="size-7" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5">
              <span className="text-2xl font-extrabold tracking-tight text-zinc-900 font-display">
                Nexus Social
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-mono font-medium text-brand-700 border border-brand-200">
                v1.0
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 font-body">
              Real-time hybrid messaging and verified community
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-purple-100 bg-white/90 p-8 shadow-xl shadow-purple-900/5 backdrop-blur-md">
          <div className="text-center space-y-2 mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 font-display">
              Sign In to Your Account
            </h1>
            <p className="text-[13.5px] text-zinc-600 leading-relaxed font-body">
              Authentication is required to enter the platform. Sign in with your Google account to access your feed, profile, and direct messages.
            </p>
          </div>

          {/* Error notice if present */}
          {errorMessage && (
            <div className="mb-6 flex items-start gap-2.5 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200">
              <AlertCircle className="size-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Sign-in Notice</p>
                <p className="mt-0.5 text-[11px] leading-normal">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Google Sign-in CTA */}
          <div className="space-y-4">
            <a
              href="/api/auth/google"
              className="group flex w-full items-center justify-center gap-3 rounded-2xl border border-zinc-200 bg-white px-5 py-3.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2"
            >
              {/* Google 4-color SVG Logo */}
              <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </a>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-zinc-100" />
              <span className="absolute bg-white px-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
                Guaranteed Access Protection
              </span>
            </div>

            {/* Platform benefits highlights */}
            <div className="space-y-2.5 pt-1 text-left text-xs text-zinc-600">
              <div className="flex items-center gap-2.5 rounded-xl bg-purple-50/70 p-2.5">
                <Users className="size-4 shrink-0 text-brand-700" />
                <span className="font-medium text-[11px] text-zinc-700">
                  Exclusive member directory with verified profiles
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-purple-50/70 p-2.5">
                <MessageSquare className="size-4 shrink-0 text-brand-700" />
                <span className="font-medium text-[11px] text-zinc-700">
                  Instant 1-on-1 real-time chat via WebSockets
                </span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-purple-50/70 p-2.5">
                <ShieldCheck className="size-4 shrink-0 text-brand-700" />
                <span className="font-medium text-[11px] text-zinc-700">
                  Encrypted HTTP-only cookie session authentication
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-zinc-600">
          Nexus Social &bull; Strictly authenticated platform access
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
