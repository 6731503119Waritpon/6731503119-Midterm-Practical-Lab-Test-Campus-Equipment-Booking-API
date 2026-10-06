# AI Assistance Log (AI_LOG.md)

**Student Name:** Waritpon Kokong
**Student ID:** 6731503119  
**Course:** 2026_PlatformDev — Midterm Practical Lab Test  
**Project:** Campus Equipment Booking API  

---

## 1. AI Usage Overview

During this lab test, AI assistance was utilized as a pair programming and brainstorming assistant for:
1. Analyzing the Common API Contract and defining the SQLite/D1 schema (`schema.sql`).
2. Formulating the overlap detection logic for scheduling reservations.
3. Scaffolding Hono route handlers with input validation and parameter binding.
4. Structuring curl test commands and recording test evidence.

All AI suggestions were carefully inspected, tested against local D1 SQLite storage, and verified against the rubric requirements.

---

## 2. Prompt Log and Decisions

### Entry 1: Schema Design & Equipment Seeding
* **Prompt:**
  > "Design SQLite D1 schema for campus equipment booking. Equipment needs at least 2 seed items with id, name, location. Bookings need id, equipmentId, borrowerName, startAt, endAt, purpose, and timestamps."
* **AI Output:**
  * Created table definitions for `equipment` and `bookings` with foreign key relationship.
  * Added seed equipment (`eq-1`, `eq-2`, `eq-3`).
* **Verification & Modifications:**
  * Verified field names match the API Contract strictly (`borrowerName`, `equipmentId`, `startAt`, `endAt`).
  * Added index `idx_bookings_lookup` on `(equipmentId, startAt, endAt)` to ensure query performance when checking overlaps.

---

### Entry 2: Time Overlap Detection Logic
* **Prompt:**
  > "What is the correct SQL condition to detect overlapping bookings for the same equipment? Ensure when updating via PATCH that the booking doesn't conflict with itself."
* **AI Output:**
  * Suggested condition: `startAt < newEndAt AND endAt > newStartAt`.
* **Verification & Modifications:**
  * Handled mathematical edge cases: Tested whether back-to-back bookings (e.g. 09:00–10:00 and 10:00–11:00) conflict. Because `<` and `>` are strict inequalities, adjacent slots do not conflict, which is correct for booking time slots.
  * In `PATCH /bookings/:id`, verified that `id != ?` is bound properly so updating the purpose or borrower of a booking does not flag the booking as conflicting with itself.

---

### Entry 3: Security & SQL Parameter Binding
* **Prompt:**
  > "How to write Hono D1 endpoints ensuring parameter binding is strictly followed without SQL string concatenation?"
* **AI Output:**
  * Used `env.DB.prepare('... ? ...').bind(...)`.
* **Verification & Modifications:**
  * Manually verified every single `.prepare()` call in `src/index.ts`. Confirmed zero template literal interpolations or string concatenations (`+`) in SQL queries.
  * Confirmed all user inputs are passed via positional parameters (`?`).

---

### Entry 4: CORS and Dual Route Mounting
* **Prompt:**
  > "Support both /api/bookings and /bookings so any frontend tester or curl command works without path mismatch errors."
* **AI Output:**
  * Suggested mounting the same Hono sub-app on both `/api` and `/`.
* **Verification & Modifications:**
  * Tested both `curl http://localhost:8787/equipment` and `curl http://localhost:8787/api/equipment`. Both returned identical valid JSON responses with CORS headers (`Access-Control-Allow-Origin: *`).

