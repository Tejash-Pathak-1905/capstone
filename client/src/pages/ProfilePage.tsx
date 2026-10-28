"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { User, Mail, Calendar, Edit3, Check, Sparkles, ShieldCheck } from "lucide-react";

export function ProfilePage() {
  const { user, refreshUser, setDemoUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await api.updateProfile({ name, bio });
      if (res.success) {
        setMessage("Profile updated successfully!");
        setIsEditing(false);
        await refreshUser();
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestLogin = () => {
    setDemoUser({
      id: "demo-user-1",
      email: "alex@example.com",
      name: "Alex Morgan",
      username: "alexmorgan",
      bio: "Full stack developer & UI designer passionate about delightful animations.",
      newUser: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handleTestNewUser = () => {
    setDemoUser({
      id: "demo-user-new",
      email: "newcreator@example.com",
      name: "Jordan Lee",
      username: "",
      bio: "",
      newUser: true,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-left">
      <div className="rounded-3xl border border-purple-100 bg-white p-6 sm:p-8 shadow-sm">
        {/* Banner with avatar */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-brand-700 to-indigo-600 text-2xl font-bold text-white shadow-lg shadow-brand-700/25">
            {(user?.name || user?.username || "U")[0]?.toUpperCase() || "U"}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-zinc-900">{user?.name || "Guest User"}</h1>
                <p className="text-xs font-semibold text-brand-700">
                  @{user?.username || "anonymous"}
                </p>
              </div>

              {user && !user.newUser && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setName(user.name || "");
                    setBio(user.bio || "");
                    setIsEditing(!isEditing);
                  }}
                  className="rounded-xl border-purple-200"
                >
                  <Edit3 className="size-3.5 mr-1.5" />
                  <span>{isEditing ? "Cancel" : "Edit Profile"}</span>
                </Button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-zinc-400" />
                {user?.email || "No email available"}
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                {user?.newUser ? "Pending Onboarding" : "Profile Verified"}
              </span>
            </div>
          </div>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            {message}
          </div>
        )}

        {/* Edit or View Details */}
        <div className="mt-6 pt-6 border-t border-zinc-100">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-700"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-700">Bio</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-brand-700"
                />
              </div>

              <Button
                type="submit"
                disabled={isSaving}
                className="bg-brand-700 hover:bg-brand-800 text-white rounded-xl"
              >
                <Check className="size-4 mr-1.5" />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">About</h3>
              <p className="text-sm leading-relaxed text-zinc-700">
                {user?.bio || "No biography provided yet. Click 'Edit Profile' to introduce yourself."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dev helper switcher for demo and testing */}
      <div className="rounded-3xl border border-dashed border-purple-200 bg-white/60 p-5">
        <h4 className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 mb-2">
          <Sparkles className="size-3.5 text-brand-700" />
          <span>Local Simulation & Role Testing</span>
        </h4>
        <p className="text-[11px] text-zinc-500 mb-3">
          Quickly switch roles to test completed vs pending onboarding flows:
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestLogin}
            className="text-xs rounded-xl"
          >
            Simulate Onboarded User
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestNewUser}
            className="text-xs rounded-xl text-brand-700 border-brand-300 bg-brand-50/50"
          >
            Simulate New User (Triggers Onboarding Dialog)
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
