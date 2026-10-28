"use client";

import React, { useState } from "react";
import { ChatMessages } from "@/components/ui/chat-messages";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Sparkles, FileText, CheckCircle2 } from "lucide-react";

export function DemoPage() {
  const [hasReadToBottom, setHasReadToBottom] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const content = contentRef.current;
    if (!content) return;

    const scrollPercentage =
      content.scrollTop / (content.scrollHeight - content.clientHeight);
    if (scrollPercentage >= 0.95 && !hasReadToBottom) {
      setHasReadToBottom(true);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto text-left">
      {/* Intro section */}
      <div className="rounded-3xl border border-purple-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-700 text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="size-4" />
          <span>Interactive Component Sandbox</span>
        </div>
        <h2 className="text-xl font-bold text-zinc-900">
          Component Gallery & Styling Verification
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          Verify the 21st.dev Chat Messages component and Dialog component styled with the purple/lavender reference palette.
        </p>

        {/* Dialog Demo Trigger */}
        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-brand-700 hover:bg-brand-800 text-white rounded-xl shadow-sm">
                <FileText className="size-4 mr-2" />
                Open Terms & Conditions Dialog
              </Button>
            </DialogTrigger>
            <DialogContent className="flex flex-col gap-0 p-0 sm:max-h-[min(640px,80vh)] sm:max-w-lg [&>button:last-child]:top-3.5 border-purple-100">
              <DialogHeader className="contents space-y-0 text-left">
                <DialogTitle className="border-b border-zinc-100 px-6 py-4 text-base font-bold text-zinc-900">
                  Terms & Conditions
                </DialogTitle>
                <div
                  ref={contentRef}
                  onScroll={handleScroll}
                  className="overflow-y-auto px-6 py-4 max-h-[380px] scrollbar-thin scrollbar-thumb-zinc-300"
                >
                  <DialogDescription asChild>
                    <div className="space-y-4 text-xs leading-relaxed text-zinc-600">
                      <div className="space-y-1">
                        <strong className="text-zinc-900">Acceptance of Terms</strong>
                        <p>
                          By accessing and using this social networking platform, users agree to comply with and be bound by these Terms of Service.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-zinc-900">User Account Responsibilities</strong>
                        <p>
                          Users are responsible for maintaining the confidentiality of their credentials and profiles. Any activity under the account is the user's responsibility.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-zinc-900">Real-Time Chat & Communications</strong>
                        <p>
                          All direct messages sent via WebSockets or REST are subject to community guidelines and mutual respect.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-zinc-900">Privacy & Data Handling</strong>
                        <p>
                          User profile data is stored in PostgreSQL and message history is stored in MongoDB. Session state is managed via secure HTTP cookies.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <strong className="text-zinc-900">Scroll to confirm</strong>
                        <p>
                          Please review the entire agreement before accepting the terms. Thank you for building a safer platform!
                        </p>
                      </div>
                    </div>
                  </DialogDescription>
                </div>
              </DialogHeader>

              <DialogFooter className="border-t border-zinc-100 px-6 py-4 sm:items-center">
                {!hasReadToBottom && (
                  <span className="grow text-xs text-zinc-400 max-sm:text-center">
                    Read to the bottom to accept.
                  </span>
                )}
                <DialogClose asChild>
                  <Button type="button" variant="outline" className="rounded-xl">
                    Cancel
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    type="button"
                    disabled={!hasReadToBottom}
                    className="bg-brand-700 hover:bg-brand-800 text-white rounded-xl"
                  >
                    <CheckCircle2 className="size-4 mr-1.5" />
                    I agree
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Standalone Chat Messages Display matching the Reference Image */}
      <div className="flex flex-col items-center justify-center p-4">
        <h3 className="mb-4 text-sm font-semibold text-zinc-700">
          Interactive Themed Chat Component
        </h3>
        <ChatMessages
          className="h-[560px] w-full max-w-md"
          autoPlay={false}
          interactive={true}
          showReplay={true}
        />
      </div>
    </div>
  );
}

export default DemoPage;
