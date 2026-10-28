# Architectural Decision Records (ADR) & Decisions Log

## Overview
This document records significant architectural, technical, and structural decisions made throughout the lifecycle of the Minimal Social Media Platform capstone project.

---

## ADR 001: Hybrid Data Strategy (PostgreSQL + MongoDB)
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  The platform manages two distinct classes of data:
  1. Relational, transactional user profile and authentication state requiring ACID guarantees and unique constraints.
  2. Append-heavy, chronological messaging and conversation threads requiring high write throughput and flexible document schemas.
- **Decision:**
  Use **PostgreSQL** for user identities, credentials, usernames, bios, and onboarding flags (`new_user`). Use **MongoDB** for 1-on-1 conversations and message logs. Reference the PostgreSQL user `UUID` inside MongoDB documents.
- **Consequences:**
  - Clear separation of relational vs document workloads.
  - No distributed 2PC transactions required because messages only reference established user UUIDs.
  - Cross-database integrity is enforced at the application middleware level.

---

## ADR 002: Soft-Gating First-Time Users via `newUser` Flag
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  Google OAuth accounts lack application-specific handles (`username`) and bios. Allowing incomplete profiles to initiate messages pollutes user discovery with unidentifiable accounts.
- **Decision:**
  Implement `onboardingGateMiddleware` on the backend. When `newUser === true`, allow read-only access (discovery browsing and profile inspection) while strictly blocking messaging creation (`POST /api/conversations/initiate`, `POST /api/messages`) and socket room joins with `403 Forbidden` (`PROFILE_INCOMPLETE`).
- **Consequences:**
  - First-time users can explore public content without friction while spam/anonymous outreach is prevented.
  - Onboarding submission immediately updates `newUser = false` in PostgreSQL and unlocks full capabilities.

---

## ADR 003: Redis Cache-Aside for Profile Discovery Feed
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  The Discover page is heavily queried by users looking for connection targets. Direct database queries on every page scroll would bottleneck PostgreSQL.
- **Decision:**
  Employ Redis with a Cache-Aside strategy:
  - Cache user profile summaries at `user:profile:{userId}` (TTL: 15 mins).
  - Cache cursor-paginated discovery batches at `discover:page:{cursor}:{limit}` (TTL: 5 mins).
  - Invalidate profile and discovery keys whenever a user updates profile details.
- **Consequences:**
  - Sub-millisecond response times for discovery pagination.
  - Relieves load on PostgreSQL during traffic spikes.

---

## ADR 004: Normalized Participant Hashes for Idempotent Conversations
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  When two users initiate a chat, concurrent clicks or repeated navigations can accidentally create duplicate conversation threads between the same two users.
- **Decision:**
  Store a unique `participantHash` on each conversation in MongoDB consisting of the two participant UUIDs sorted lexicographically (`UUID_A:UUID_B`). Enforce a unique index on `participantHash`.
- **Consequences:**
  - Guarantees exactly one conversation document exists between any two users.
  - Lookups and creation endpoints are fully idempotent.

---

## ADR 006: Interactive Topographical Cursor-Reactive Canvas & Bespoke Non-AI Typography
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  Generic AI-generated styling often suffers from sterile system fonts, uniform font-weights, and static, template-like backgrounds. The visual identity needed to feel bespoke, human, dynamic, and state-of-the-art.
- **Decision:**
  1. **Interactive Topography Canvas (`TopographyBackground.tsx`)**: Mount a full-viewport, 60fps canvas that calculates dynamic elevation isoline contours. Elevation fields warp and smoothly deform with mouse coordinates using spring/lerp interpolation, accompanied by a dynamic cursor aura.
  2. **Bespoke Non-AI Typography**:
     - Display / Headings: **Outfit** (bold, geometric curves with high character and negative tracking `-0.028em`).
     - Body / Interface: **Plus Jakarta Sans** (humanist sans-serif with nuanced font-feature settings `cv02, cv03, cv04, cv11`).
     - Handles & Numbers: **JetBrains Mono** (editorial monospace for `@username` and timestamps).
- **Consequences:**
  - Distinctive, tactile brand feel across all application views.
  - Smooth 60fps hardware-accelerated background without DOM layout reflows.

---

## ADR 007: Mobile-First Responsive Master-Detail Messaging & Social Media Navigation
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  Social media users expect a responsive mobile experience mirroring tier-one applications (Instagram Direct, WhatsApp, Telegram). On desktop, an empty chat state should remain unopened until a user explicitly clicks a conversation thread; on mobile, displaying both the thread list and chat window stacked vertically degraded usability.
- **Decision:**
  1. **Unopened Default State**: Eliminated auto-selection of the first conversation upon loading `/chat`. When no conversation is active (`selectedConversationId === null`), desktop displays a prominent ambient empty state placeholder ("Your Direct Messages" with a CTA to Discover).
  2. **Responsive Master-Detail Pattern**:
     - **Mobile (<768px)**: When `selectedConversationId === null`, only the conversation list is visible full-width. When a user clicks a conversation thread, it transitions smoothly into full-screen active chat with a header back button (`<ArrowLeft />`) to return to the list.
     - **Desktop (>=768px)**: The left pane retains the conversation list and search filter, while the right pane transitions from the empty state to the active messaging window.
  3. **Social Media Bottom Navigation Bar**: Fixed bottom tab bar on mobile (`fixed bottom-0 z-50 md:hidden`) providing quick access to Discover, Live Chats (with unread status dot), and Profile, paired with safe-area viewport bottom padding (`pb-24 md:pb-8`).
- **Consequences:**
  - Fast, intuitive, touch-friendly navigation on all mobile and tablet viewports.
  - Clean separation between thread browsing and active messaging matching native social apps.

---

## ADR 008: Real-Time In-App Message Notifications & Blue Unread Indicators
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  When a user is actively browsing outside the current chat window (e.g., viewing Discover, reviewing profiles, or having no chat open), incoming messages were silent, leaving users unaware of new incoming direct communications. Additionally, the chat input included unused accessory controls (emoji picker and file attachment).
- **Decision:**
  1. **Minimalist Chat Texting Input**: Removed extraneous emoji and paperclip attachment icon buttons from `ChatMessages`, keeping the input clean, responsive, and focused strictly on text messaging.
  2. **Real-Time Notification Toast Popup**: Added `MessageNotificationToast` with Framer Motion spring physics. When an incoming message arrives via socket and the user is not actively viewing that specific thread, a floating glassmorphic card appears showing the sender name and message preview. Clicking the popup immediately takes the user to that active conversation.
  3. **Prominent Blue Circle Unread Indicators**:
     - Whenever unread messages exist, a small blue circle indicator (`bg-blue-500`) is rendered on the top corner of the Message icon on both the desktop navbar and the mobile bottom navigation bar.
     - On the Live Chats left-pane sidebar, threads containing unread messages display a glowing blue circle badge.
     - Opening the active chat clears the unread state for that conversation and dismisses the indicator when all messages are read.
- **Consequences:**
  - Immediate awareness of incoming communication across all pages of the application.
  - One-click navigation from notification toasts to active direct chats.



