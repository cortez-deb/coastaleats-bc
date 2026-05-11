# ShiftSync Backend 

**ShiftSync** is a high-performance, enterprise-grade scheduling platform designed for the complex needs of modern hospitality and retail environments. It features an intelligent **Decision Engine** that automates labor law compliance, certification management, and staff availability tracking across multiple locations.

---

##  Tech Stack

- **Runtime**: Node.js (ESM)
- **Framework**: Express.js
- **Database**: PostgreSQL with Sequelize ORM
- **Cache & Messaging**: Redis + BullMQ (Background Jobs)
- **Real-time**: Socket.io (with Redis Adapter for scaling)
- **Time Management**: Luxon (Timezone-aware scheduling)
- **Validation**: Express-validator

---

## The Decision Engine

The heart of ShiftSync is its robust **Constraint Engine**, which performs an 8-step validation for every shift assignment. This ensures 100% compliance with labor regulations and operational requirements.

### 8-Step Validation Logic

1.  **Skill Match [HARD]**
    *   Verifies that the staff member possesses the specific `Skill` required for the shift (e.g., "Bartender", "Head Chef").
2.  **Location Certification [HARD]**
    *   Ensures the staff member is authorized/certified to work at the specific physical `Location`.
3.  **Availability Window [HARD]**
    *   Cross-references recurring availability schedules against one-off exceptions (blocked days) and approved `LeaveRequests`.
4.  **No Double-Booking [HARD]**
    *   Detects and prevents overlapping assignments across all managed locations.
5.  **Minimum Rest Gap [HARD]**
    *   Strictly enforces a **10-hour rest period** between the end of one shift and the start of the next.
6.  **Daily Hour Limit [BLOCK/WARN]**
    *   **Block (>12h)**: Prevents assignments resulting in more than 12 hours worked in a single day (Requires manager override).
    *   **Warn (>8h)**: Flags shifts that exceed the standard 8-hour workday.
7.  **Weekly Overtime [WARN]**
    *   Proactively monitors weekly hours, flagging staff as they approach or exceed the **40-hour overtime threshold**.
8.  **Consecutive Days [BLOCK/WARN]**
    *   **Block (7th Day)**: Prevents working 7 consecutive days (Requires manager override).
    *   **Warn (6th Day)**: Suggests a rest day when staff reach 6 consecutive days.

---

## ⚡ Key Features

- **Real-time Synchronization**: Powered by Socket.io, staff and managers receive instant updates for shift assignments, swaps, and notification alerts.
- **Smart Suggestions**: When a hard violation occurs, the engine automatically suggests eligible alternative staff members who meet all criteria.
- **Timezone Integrity**: Each location operates in its own IANA timezone. All logic—from availability to hour calculations—is timezone-aware, ensuring consistency for multi-state operations.
- **Background Workflows**: Uses BullMQ for reliable processing of swap cancellations, notification batching, and data cleanup.

---

## Project Structure

```text
backend/
├── config/             # Database & environment configuration
├── controllers/        # Express route handlers
├── jobs/               # BullMQ worker definitions
├── middleware/         # Auth & validation logic
├── migrations/         # Sequelize database migrations
├── models/             # Database schema (PostgreSQL)
├── routes/             # API endpoint definitions
├── seeders/            # Demo data generation
├── services/           # CORE LOGIC (Decision Engine, Labor, Leave)
├── sockets/            # Real-time event handlers
├── utils/              # Helper functions (Timezone, Logic)
└── server.js           # Entry point
```

---

##  Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- Redis

### Installation

1.  **Clone the repository**
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment**:
    Copy `.env.example` to `.env` and fill in your credentials.
    ```bash
    cp .env.example .env
    ```
4.  **Initialize Database**:
    ```bash
    npm run db:reset
    ```
5.  **Run Development Server**:
    ```bash
    npm run dev
    ```

---

##  Business Decisions

Key architectural decisions documented in [DECISIONS.md](DECISIONS.md):
- **De-certified staff**: New assignments are blocked; existing ones are preserved; pending swaps are cancelled.
- **Desired hours**: Advisory only; does not block scheduling.
- **Consecutive Day Calc**: Any shift on a calendar day counts as a full day worked.
- **Timezone Boundaries**: All logic uses the location's physical timezone.

---

&copy; 2026 ShiftSync Engineering. Built for Coastal Eats.
