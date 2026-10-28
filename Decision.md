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

## ADR 005: Testing Framework — Jest & Supertest
- **Date:** 2026-10-28
- **Status:** Accepted
- **Context:**
  A unified, reliable automated testing framework is required to test Express routing, middleware gating (auth, soft-gate), Socket.io events, and database query utilities.
- **Decision:**
  Standardize on **Jest** as the test runner and assertion library, paired with **Supertest** for HTTP API integration testing.
- **Consequences:**
  - Snapshot, mock, and coverage support built directly into Jest without extra tooling.
  - Clear test isolation for unit and integration suites.
