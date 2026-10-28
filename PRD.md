# Product Requirement Document (PRD) & Technical Architecture Specification
## Minimal Social Media Platform (Hybrid SQL + NoSQL)

---

## 1. Executive Summary & Vision

The platform is a lightweight, responsive social networking web application designed to connect individuals through profile discovery and 1-on-1 real-time direct messaging. 

### Core Product Principles
1. **Hybrid Data Strategy**: Rigid, relational, and transactional data (identities, profile fields, onboarding flags) reside in **PostgreSQL (SQL)**. Communication data (conversations, chat history, message metadata) resides in **MongoDB (NoSQL)**.
2. **Frictionless Google OAuth Onboarding**: Users sign in seamlessly with Google. First-time users (`newUser == true`) are routed to a mandatory onboarding form (`name`, `username`, `bio`). Once complete, `newUser` flips to `false` and the user lands on their personal profile page.
3. **Soft-Gated Protection**: Middleware guards protected endpoints. New users with incomplete profiles can browse profiles in read-only mode, but cannot initiate or send messages until their profile is complete.
4. **High-Performance People Discovery**: Profile cards on the Discover page are batched using cursor-based pagination and cached in **Redis** with a cache-aside pattern to prevent database strain.
5. **Real-Time Communication**: Clicking the "Message" button triggers an idempotent initiation endpoint, routing users to a dedicated 1-on-1 chat page powered by **WebSockets (Socket.io)** with message history stored in MongoDB.

---

## 2. System Architecture & Tech Stack

```
+---------------------------------------------------------------------------------+
|                                Frontend (React + Vite)                          |
|   +-----------------------+   +------------------------+   +----------------+   |
|   |  Profile Page (Own/Other) | | Discover Page (Windowed)| | Chat Room (Socket) |
|   +-----------------------+   +------------------------+   +----------------+   |
+---------------------------------------+-----------------------------------------+
                                        | HTTP / WebSocket
                                        v
+---------------------------------------------------------------------------------+
|                           Backend Server (Node.js + Express)                    |
|                                                                                 |
|   +-------------------------------------------------------------------------+   |
|   |                           Middleware Pipeline                           |   |
|   |  1. cors & helmet                                                       |   |
|   |  2. authMiddleware (Validates Google OAuth JWT / Session)                |   |
|   |  3. onboardingGateMiddleware (Soft Gate: Blocks writes if newUser=true) |   |
|   +-------------------------------------------------------------------------+   |
|                                        |                                        |
|         +------------------------------+------------------------------+         |
|         v                              v                              v         |
|  [Auth & Profile Routes]     [Discovery Routes]             [Chat & Socket Routes]
|         |                              |                              |         |
+---------|------------------------------|------------------------------|---------+
          v                              v                              v
   +--------------+               +--------------+               +--------------+
   |  PostgreSQL  | <----+        | Redis Cache  |               |   MongoDB    |
   | (Structured) |      |        | (Feed Cache) |               |  (Messaging) |
   | - Users      |      +------- | - TTL: 10m   |               | - Convs      |
   | - Profiles   |  Cache Miss   | - User Cards |               | - Messages   |
   +--------------+               +--------------+               +--------------+
```

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React (Vite), React Router | Client-side SPA, viewport-based infinite scrolling, WebSocket client |
| **Backend API** | Node.js, Express.js | REST API routes, routing middleware, authentication pipeline |
| **Real-time Comms** | Socket.io | Bidirectional WebSocket server for instant text message exchange |
| **Structured Store** | PostgreSQL 16+ | ACID relational store for user credentials, usernames, bios, `new_user` status |
| **Unstructured Store** | MongoDB 7+ (Mongoose) | Document store for flexible conversation threads and chronological messages |
| **Caching Layer** | Redis 7+ | In-memory cache for hot profile cards and discovery feeds |
| **Authentication** | Google OAuth 2.0 / OpenID Connect | Identity federation and token validation |

---

## 3. Database Schemas

### 3.1 PostgreSQL DDL (Structured Data: Users & Authentication)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    new_user BOOLEAN DEFAULT TRUE NOT NULL,
    name VARCHAR(100),
    username VARCHAR(30) UNIQUE,
    bio VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for fast lookup
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_created_at ON users(created_at DESC);
CREATE INDEX idx_users_new_user ON users(new_user);
```

#### Field Specifications:
- `id`: Internal UUIDv4 primary key. Used as reference foreign key in MongoDB.
- `google_id`: Google OAuth subject claim identifier.
- `email`: Normalized lowercase user email address.
- `new_user`: Flag initialized to `TRUE`. Switched to `FALSE` upon completing the first-time profile details submission.
- `name`: Display name entered by user during onboarding (or initialized from Google profile).
- `username`: Unique handle selected by the user during onboarding (alphanumeric, lowercase).
- `bio`: Short user description (up to 500 characters).

---

### 3.2 MongoDB Schemas (NoSQL: Conversations & Messages)

Stored using Mongoose or native MongoDB driver:

#### Collection: `conversations`
Represents a unique 1-on-1 communication channel between two registered users.

```javascript
const ConversationSchema = new mongoose.Schema({
  // Stores PostgreSQL UUIDs of the two participants, sorted alphabetically to guarantee uniqueness
  participants: {
    type: [String],
    required: true,
    validate: [val => val.length === 2, 'A 1-on-1 conversation must have exactly 2 participants']
  },
  // Normalized compound identifier: "UUID_A:UUID_B" (sorted)
  participantHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  lastMessage: {
    text: { type: String, default: '' },
    senderId: { type: String }, // PostgreSQL UUID
    sentAt: { type: Date, default: Date.now }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ updatedAt: -1 });
```

#### Collection: `messages`
Stores individual text messages belonging to a conversation.

```javascript
const MessageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderId: {
    type: String, // PostgreSQL UUID
    required: true,
    index: true
  },
  recipientId: {
    type: String, // PostgreSQL UUID
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Compound index for chronological querying within a chat room
MessageSchema.index({ conversationId: 1, createdAt: 1 });
```

---

### 3.3 Redis Caching Strategy

| Key Pattern | Data Structure | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `user:profile:{userId}` | JSON String / Hash | 15 minutes | Individual public profile card (`id`, `name`, `username`, `bio`). |
| `discover:page:{cursor}:{limit}` | JSON String (Array) | 5 minutes | Paginated list of user profile summaries for Discovery feed. |

#### Invalidation Rules:
- When a user submits their profile completion or profile updates (`PUT /api/users/profile`), invalidate:
  1. `user:profile:{userId}`
  2. Pattern scan / flush `discover:page:*` tags.

---

## 4. Middleware Architecture & Gatekeeper Rules

The Express backend uses a modular middleware pipeline:

```
[Incoming Request]
        |
        v
[1. authMiddleware] 
    - Extracts JWT from HTTP-only cookie or Authorization: Bearer header.
    - Decodes payload: { userId, email, newUser }.
    - Attaches `req.user` to the request object.
    - If token missing or invalid -> Returns 401 Unauthorized.
        |
        v
[2. onboardingGateMiddleware] (Soft Gatekeeper)
    - Checks `req.user.newUser`.
    - If `newUser === true`:
        - ALLOWS:
            * `GET /api/users/me` (to populate onboarding form)
            * `POST /api/users/complete-profile` (to submit details)
            * `GET /api/users/discover` (Read-only browsing)
            * `GET /api/users/:userId` (Read-only profile viewing)
        - BLOCKS (Returns 403 Forbidden with `{ code: 'PROFILE_INCOMPLETE', message: 'You must complete your profile first' }`):
            * `POST /api/conversations/initiate`
            * `POST /api/messages`
            * Socket connection handshakes requesting room joins
    - If `newUser === false`:
        - Passes through to all controllers immediately.
```

---

## 5. End-to-End User Journeys & Flow Walkthroughs

### Flow 1: First-Time User Login & Onboarding
1. User clicks **"Sign in with Google"** on the landing/login view.
2. Frontend redirects to Google OAuth consent screen.
3. Google returns authorization code to backend callback `GET /api/auth/google/callback`.
4. Backend exchanges code for Google user details (`sub`, `email`, `name`).
5. Backend checks PostgreSQL `users` table:
   - User does **not** exist.
   - Insert new row:
     ```sql
     INSERT INTO users (google_id, email, name, new_user)
     VALUES ($1, $2, $3, TRUE) RETURNING *;
     ```
6. Backend generates a signed JWT session containing `{ userId, email, newUser: true }` and sets an HTTP-only secure cookie.
7. Backend redirects frontend to `/onboarding`.
8. Frontend detects `user.newUser === true` and renders the **Complete Profile Form**:
   - Fields: Name (prefilled from Google), Username (input), Bio (textarea).
9. User fills out username (e.g. `@alex99`) and bio, then clicks **"Save & Continue"**.
10. Frontend calls `POST /api/users/complete-profile` with `{ name, username, bio }`.
11. Backend validates username uniqueness in PostgreSQL:
    - Updates row:
      ```sql
      UPDATE users 
      SET name = $1, username = $2, bio = $3, new_user = FALSE, updated_at = NOW()
      WHERE id = $4 RETURNING *;
      ```
12. Backend re-issues updated JWT with `newUser: false`.
13. Frontend receives successful response, sets user state, and immediately routes to the user's **Profile Page** (`/profile`).

---

### Flow 2: Returning User Login
1. Returning user clicks **"Sign in with Google"**.
2. Backend matches existing `google_id` in PostgreSQL.
3. User record has `new_user == false`.
4. Backend sets session cookie with `{ userId, email, newUser: false }`.
5. Frontend loads, queries `GET /api/users/me`, reads `newUser: false`, and directly opens `/profile`.

---

### Flow 3: Discovering People (Viewport & Cache-Optimized)
1. User navigates to `/discover`.
2. Frontend has an infinite-scroll viewport list (e.g. 15 profiles per batch).
3. Initial request sent: `GET /api/users/discover?limit=15&cursor=`.
4. **Backend Caching & Fetching**:
   - Backend queries Redis key `discover:page:initial:15`.
   - **Cache Hit**: Returns cached JSON array of profile summaries instantly.
   - **Cache Miss**:
     - Executes indexed PostgreSQL query:
       ```sql
       SELECT id, name, username, bio, created_at
       FROM users
       WHERE new_user = FALSE AND id != $currentUserId
       ORDER BY created_at DESC
       LIMIT 15;
       ```
     - Caches result in Redis with a 5-minute TTL.
     - Returns data + `nextCursor` (timestamp of the 15th item).
5. As user scrolls down and the bottom trigger enters the viewport (using `IntersectionObserver`), the next request fires:
   `GET /api/users/discover?limit=15&cursor=2026-10-28T09:00:00Z`.
6. Only profiles currently in or near viewport are rendered in memory, ensuring low browser overhead and minimal database queries.

---

### Flow 4: Profile Viewing & Direct Messaging
1. User A visits User B's public profile page (`/users/:userId`).
2. Profile displays User B's name, username, and bio.
3. User A clicks the **"Message"** button.
4. If User A still has `newUser == true`, frontend prompts a modal: *"Please complete your profile first before sending messages"* and blocks the action.
5. If User A is fully onboarded (`newUser == false`), frontend calls:
   `POST /api/conversations/initiate` with `{ recipientId: "USER_B_UUID" }`.
6. **Backend Idempotent Conversation Handler**:
   - Hashes sorted IDs: `[UserA_UUID, UserB_UUID].sort().join(':')`.
   - Queries MongoDB:
     ```javascript
     let conv = await Conversation.findOne({ participantHash: hash });
     if (!conv) {
       conv = await Conversation.create({
         participants: [UserA_UUID, UserB_UUID],
         participantHash: hash
       });
     }
     return res.json({ conversationId: conv._id });
     ```
7. Frontend receives `{ conversationId: "65a..." }` and navigates to the **Communication Page**: `/chat/65a...`.
8. Frontend connects to WebSocket namespace `/chat` and emits event `join_room` with `{ conversationId }`.
9. Page loads previous messages via `GET /api/conversations/:id/messages?limit=50`.
10. User A types a message and clicks **Send** (or hits Enter).
11. Client emits WebSocket event:
    ```javascript
    socket.emit('send_message', {
      conversationId: '65a...',
      recipientId: 'USER_B_UUID',
      content: 'Hello, loved your profile!'
    });
    ```
12. Server receives event, validates authentication, persists message to MongoDB:
    ```javascript
    const msg = await Message.create({
      conversationId,
      senderId: req.user.id,
      recipientId,
      content
    });
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: { text: content, senderId: req.user.id, sentAt: new Date() }
    });
    ```
13. Server broadcasts `new_message` to the conversation room:
    ```javascript
    io.to(conversationId).emit('receive_message', msg);
    ```
14. Both User A and User B (if online in the room) see the message appear immediately in real-time.

---

## 6. Functional Specifications of the Three Main Views

### View 1: Profile Page
- **Mode A: Own Profile (`/profile`)**
  - Displays authenticated user's name, username (`@handle`), and bio.
  - Quick action: "Edit Profile" (updates name, bio in PostgreSQL).
  - Navigation bar to access "Discover People" and "Messages".
- **Mode B: Other User's Profile (`/users/:userId`)**
  - Displays target user's details retrieved from Redis / PostgreSQL.
  - **"Message" Button**: Primary call-to-action that initiates the 1-on-1 chat.

### View 2: Communication Page (`/chat/:conversationId`)
- Header displaying the recipient's name, username, and online status.
- Chronological message log (incoming messages on left, outgoing on right).
- Auto-scroll to bottom upon new message arrival.
- Fixed bottom input bar: Text input + "Send" button.
- Real-time indicator for message delivery.

### View 3: Discover People Page (`/discover`)
- Clean grid or feed of profile summary cards:
  - Name, `@username`, and truncated bio.
  - Direct "View Profile" link or "Message" shortcut.
- Windowed / Infinite Scroll loader triggered by viewport intersection.
- Fast, cached responses powered by Redis.

---

## 7. API & WebSocket Specifications

### 7.1 REST Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/google` | Public | Initiates Google OAuth redirect |
| `GET` | `/api/auth/google/callback`| Public | Handles Google OAuth callback, sets session JWT |
| `POST`| `/api/auth/logout` | Authenticated | Clears session cookie |
| `GET` | `/api/users/me` | Authenticated | Returns current user profile + `newUser` status |
| `POST`| `/api/users/complete-profile` | Authenticated (`newUser=true` allowed) | Updates name, username, bio; sets `new_user = false` |
| `GET` | `/api/users/profile/:userId` | Authenticated (Soft Gated) | Fetches a specific user's public profile |
| `GET` | `/api/users/discover` | Authenticated (Soft Gated) | Paginated list of profiles (`?cursor=&limit=15`) |
| `POST`| `/api/conversations/initiate`| Authenticated (`newUser=false` required) | Gets or creates a 1-on-1 conversation in MongoDB |
| `GET` | `/api/conversations/:id/messages`| Authenticated (`newUser=false` required) | Fetches past message history for a conversation |

---

### 7.2 WebSocket Events (Socket.io)

| Event Name | Direction | Payload | Description |
| :--- | :--- | :--- | :--- |
| `connection` | Client -> Server | Handshake auth token | Authenticates socket connection |
| `join_room` | Client -> Server | `{ conversationId }` | User joins specific chat room |
| `send_message` | Client -> Server | `{ conversationId, recipientId, content }` | Client sends a text message |
| `receive_message` | Server -> Client | `{ _id, conversationId, senderId, content, createdAt }` | Server pushes new message to room |
| `leave_room` | Client -> Server | `{ conversationId }` | User leaves chat room |

---

## 8. Non-Functional Requirements & Security

1. **Authentication Security**:
   - JWT tokens stored exclusively in `HttpOnly`, `SameSite=Lax` (or `Strict`), `Secure` cookies to protect against XSS.
   - CSRF protection enabled on state-changing API endpoints.
2. **Data Consistency & Integrity**:
   - PostgreSQL enforces unique constraints on `email` and `username`.
   - MongoDB indexes ensure conversation idempotency so duplicate threads between the same two users are impossible.
3. **Cache Invalidation**:
   - Cache-aside strategy with short TTLs (5–15 minutes) ensures Redis never serves stale profiles for long if a user edits their details.
4. **Scalability**:
   - Stateless Express servers allowing easy horizontal scaling behind an Nginx load balancer.
   - Redis adapter for Socket.io if scaling WebSocket servers across multiple instances.

---

## 9. Phased Implementation Roadmap

- **Phase 1: Project Setup & Hybrid Databases**
  - Initialize Node/Express backend and React/Vite frontend.
  - Setup PostgreSQL connection pool (`pg` or Prisma/Drizzle).
  - Setup MongoDB connection via Mongoose.
  - Configure Redis client.
- **Phase 2: Authentication & Onboarding Gatekeeper**
  - Implement Google OAuth login and JWT generation.
  - Build `authMiddleware` and `onboardingGateMiddleware`.
  - Create `/onboarding` form in React to update `new_user` from `true` to `false`.
- **Phase 3: Profile & Discover People (with Caching)**
  - Implement `/profile` and public `/users/:userId` views.
  - Implement `GET /api/users/discover` with cursor pagination and Redis caching.
  - Build frontend infinite scroll with viewport observer.
- **Phase 4: Real-Time Messaging**
  - Implement `POST /api/conversations/initiate` in MongoDB.
  - Set up Socket.io server and client rooms.
  - Build `/chat/:conversationId` page with message persistence and real-time streaming.
