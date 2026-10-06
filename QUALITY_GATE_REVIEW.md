# Quality Gate Review (QUALITY_GATE_REVIEW.md)

**Review Date & Time:** Tuesday, 6 October 2026 (~Minute 30 Snapshot)  
**Project:** Campus Equipment Booking API
**Student Name:** Waritpon Kokong  
**Student ID:** 6731503119  
**Reviewer:** Student (Self-Assessment & Verification)  

---

## 1. Pre-30-Minute Snapshot

* **Initial State:** Core schema initialized, seed equipment populated, initial Hono routes created for `equipment` and `bookings`.
* **Git Snapshot Commit:** `git commit -m "feat: initial API implementation before 30-min quality gate"`
* **Verification Scope:** Reliability & Accuracy, Security, Business Logic, and Error Handling.

---

## 2. Quality Gate Findings, Fixes, and Verification

### Finding 1: Self-Collision Bug on Partial Update (Reliability / Accuracy)
* **What Was Found:**
  During partial updates via `PATCH /bookings/:id`, if the user updates non-temporal fields (such as `purpose` or `borrowerName`) while keeping existing booking timestamps, a naive overlap query (`SELECT ... WHERE equipmentId = ? AND startAt < ? AND endAt > ?`) would detect the current booking record itself as a conflicting overlap. This resulted in an erroneous `409 Conflict` on valid updates.
* **How It Was Fixed:**
  Updated the overlap detection query for the PATCH endpoint to explicitly exclude the current record ID:
  ```sql
  SELECT id, borrowerName, startAt, endAt FROM bookings
  WHERE equipmentId = ?
    AND id != ?
    AND status != 'CANCELLED'
    AND startAt < ?
    AND endAt > ?
  LIMIT 1
  ```
  Bound `targetEquipmentId`, `id`, `targetEndAt`, and `targetStartAt` securely with parameter binding.
* **Evidence:**
  Sent a `PATCH` request modifying only the purpose field:
  ```bash
  curl -i -X PATCH http://localhost:8787/api/bookings/bkg-1a6d6666 \
    -H "Content-Type: application/json" \
    -d "{\"purpose\":\"Updated: Final presentation\"}"
  ```
  Result returned `HTTP/1.1 200 OK` with updated purpose, successfully proving the self-conflict bug was resolved.

---

### Finding 2: Security & Parameter Binding Verification (Security / You Own It)
* **What Was Found:**
  AI-generated database logic sometimes mixes parameterized queries with string interpolation or lacks strict typing on dynamic parameters. Direct concatenation in SQL queries opens serious SQL injection vulnerabilities.
* **How It Was Fixed:**
  Audited every single database operation across all CRUD routes in `src/index.ts`. Guaranteed that 100% of queries use Cloudflare D1's prepared statements and `.bind(...)`:
  - `equipment` lookup: `.prepare('SELECT id FROM equipment WHERE id = ?').bind(equipmentId.trim())`
  - `bookings` insert: `.prepare('INSERT INTO bookings (...) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(...)`
  - `bookings` delete: `.prepare('DELETE FROM bookings WHERE id = ?').bind(id)`
* **Evidence:**
  Tested with malicious injection payload:
  ```bash
  curl -i -X POST http://localhost:8787/api/bookings \
    -H "Content-Type: application/json" \
    -d "{\"equipmentId\":\"eq-1' OR '1'='1\",\"borrowerName\":\"Attacker\",\"startAt\":\"2026-10-20T09:00:00.000Z\",\"endAt\":\"2026-10-20T11:00:00.000Z\",\"purpose\":\"Hack\"}"
  ```
  Result returned `HTTP/1.1 400 Bad Request` with `{"error":"Equipment with ID 'eq-1\' OR \'1\'=\'1' does not exist"}`, confirming parameter sanitization safely neutralizes injection vectors.

---

### Finding 3: Input Validation & Chronological Integrity (Reliability / Accuracy)
* **What Was Found:**
  Incoming timestamps in `startAt` and `endAt` were initially parsed without validating if the strings were valid ISO 8601 dates or if `startAt` occurred after `endAt` (e.g., end time in the past relative to start time).
* **How It Was Fixed:**
  Added comprehensive date validation logic:
  1. Validated presence and non-empty string types.
  2. Verified valid ISO date format via `!isNaN(new Date(startAt).getTime())`.
  3. Enforced chronological ordering: `startDate.getTime() >= endDate.getTime() -> return 400`.
  4. Standardized error format to `{ "error": "..." }` as mandated by the exam specification.
* **Evidence:**
  Sent an inverted time range where `startAt` is later than `endAt`:
  ```bash
  curl -i -X POST http://localhost:8787/api/bookings \
    -H "Content-Type: application/json" \
    -d "{\"equipmentId\":\"eq-1\",\"borrowerName\":\"Somsak\",\"startAt\":\"2026-10-20T15:00:00.000Z\",\"endAt\":\"2026-10-20T14:00:00.000Z\",\"purpose\":\"Test invalid time\"}"
  ```
  Result returned `HTTP/1.1 400 Bad Request` with body:
  `{"error":"startAt must be strictly earlier than endAt"}`.

---

## 3. Summary of Improvements
| Quality Gate Dimension | Pre-Review | Post-Review Improvement |
| :--- | :--- | :--- |
| **Reliability** | PATCH could fail with false 409 | Accurate conflict checking excluding current entity |
| **Security** | Generic queries | 100% Parameter Binding on all D1 interactions |
| **Robustness** | Basic null check | Comprehensive ISO date & chronological validation |
| **API Contract** | Single base path | Mounted on both `/` and `/api` with CORS for tester support |

---

## 4. Quality Gate Review Record

| Quality Gate area | Finding | Action taken | Evidence |
|---|---|---|---|
| **Reliability** | An update (`PATCH`) could conflict with its own existing booking during partial update. | Excluded the booking being updated (`AND id != ?`) from the overlap query in `PATCH`. | Added an update test (`PATCH /api/bookings/:id`); it returns `200 OK` without false conflict. |
| **Security / Accuracy** | Direct SQL string interpolation risk in D1 database calls. | Refactored all database operations to strictly use D1 parameter binding (`.prepare(...).bind(...)`). | Audited `src/index.ts`; injection payloads return `400 Bad Request` safely without SQL execution. |
| **Reasoning / You Own It** | Timestamps lacked strict ISO format and chronological check (`startAt < endAt`). | Enforced ISO 8601 parsing and `startDate >= endDate -> 400` validation with `{ "error": "..." }` response. | Tested inverted time range (`startAt > endAt`); returns `400 Bad Request` with required error JSON. |

---

## 5. Submission Decision

* [x] **READY:** All required work is complete, all 8 checks from `quality_gate.md` pass, tests have been verified with `curl_test_guide.md`, and all code can be clearly explained.


