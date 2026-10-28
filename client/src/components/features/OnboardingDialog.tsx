"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, User, AtSign, FileText, AlertCircle, CheckCircle2 } from "lucide-react";

export interface OnboardingFormValues {
  name: string;
  username: string;
  bio: string;
}

export interface OnboardingDialogProps {
  open: boolean;
  initialName?: string;
  onSubmit: (values: OnboardingFormValues) => Promise<{ success: boolean; error?: string }>;
}

export function OnboardingDialog({
  open,
  initialName = "",
  onSubmit,
}: OnboardingDialogProps) {
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill name if passed from Google profile
  React.useEffect(() => {
    if (initialName && !name) {
      setName(initialName);
    }
  }, [initialName, name]);

  const validate = (): string | null => {
    if (!name.trim()) return "Full name is required.";
    if (name.trim().length > 100) return "Name cannot exceed 100 characters.";

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) return "Username is required.";
    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return "Username must be between 3 and 30 characters.";
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      return "Username can only contain letters, numbers, and underscores.";
    }

    if (bio.length > 500) {
      return "Bio cannot exceed 500 characters.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const res = await onSubmit({
        name: name.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
      });

      if (!res.success && res.error) {
        setError(res.error);
      }
    } catch (err: any) {
      setError(err?.message || "Something went wrong while completing your profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden border border-purple-100 shadow-2xl [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header with lavender gradient banner */}
        <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-600 p-6 text-white text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur-sm mb-3">
            <Sparkles className="size-3.5" />
            <span>Welcome aboard</span>
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-white">
            Complete Your Profile
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-purple-100">
            Set up your identity to unlock direct messaging and profile discovery.
          </DialogDescription>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-left">
          {error && (
            <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in">
              <AlertCircle className="size-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="onboarding-name"
              className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5"
            >
              <User className="size-3.5 text-brand-700" />
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              id="onboarding-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex Morgan"
              maxLength={100}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:bg-white focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="onboarding-username"
                className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5"
              >
                <AtSign className="size-3.5 text-brand-700" />
                Username <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-400">3-30 chars, lowercase</span>
            </div>
            <div className="relative">
              <input
                id="onboarding-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                placeholder="alexmorgan"
                maxLength={30}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:bg-white focus:ring-2 focus:ring-brand-700/20"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="onboarding-bio"
                className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5"
              >
                <FileText className="size-3.5 text-brand-700" />
                Bio (Optional)
              </label>
              <span className="text-[10px] text-zinc-400">{bio.length}/500</span>
            </div>
            <textarea
              id="onboarding-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others what you build, learn, or love..."
              maxLength={500}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2 text-sm text-zinc-900 outline-none transition focus:border-brand-700 focus:bg-white focus:ring-2 focus:ring-brand-700/20"
            />
          </div>

          <DialogFooter className="pt-2 border-t border-zinc-100 flex items-center justify-end gap-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-brand-700 hover:bg-brand-800 text-white rounded-xl px-5 py-2 shadow-md shadow-brand-700/20 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Complete & Enter</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default OnboardingDialog;
