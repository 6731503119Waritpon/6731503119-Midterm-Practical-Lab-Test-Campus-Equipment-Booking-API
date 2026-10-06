# API Contract: Campus Equipment Booking API

**Base URL (Local):** `http://localhost:8787` (both `/api` prefix and root paths are supported)  
**Content-Type:** `application/json`

---

## 1. Equipment Resource

### `GET /api/equipment` (or `/equipment`)
Returns a list of all available campus equipment and rooms.

* **Response Status:** `200 OK`
* **Response Body:**
```json
[
  {
    "id": "eq-1",
    "name": "Projector A",
    "location": "Building 1"
  },
  {
    "id": "eq-2",
    "name": "Sony Alpha 7 IV Camera",
    "location": "Media Center, Room 204"
  },
  {
    "id": "eq-3",
    "name": "Meeting Room 301",
    "location": "Building 3, 3rd Floor"
  }
]
```

---

## 2. Bookings Resource

### `GET /api/bookings`
List all booking records ordered by `startAt` ascending.

* **Response Status:** `200 OK`
* **Response Body:**
```json
[
  {
    "id": "bkg-1a2b3c4d",
    "equipmentId": "eq-1",
    "borrowerName": "Somchai Jaidee",
    "startAt": "2026-10-20T09:00:00.000Z",
    "endAt": "2026-10-20T11:00:00.000Z",
    "purpose": "Class presentation",
    "status": "CONFIRMED",
    "createdAt": "2026-10-06T06:30:00.000Z",
    "updatedAt": "2026-10-06T06:30:00.000Z"
  }
]
```

---

### `GET /api/bookings/:id`
Retrieve a single booking record by ID.

* **Success Status:** `200 OK`
* **Response Body:**
```json
{
  "id": "bkg-1a2b3c4d",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation",
  "status": "CONFIRMED",
  "createdAt": "2026-10-06T06:30:00.000Z",
  "updatedAt": "2026-10-06T06:30:00.000Z"
}
```
* **Error Status (Not Found):** `404 Not Found`
```json
{
  "error": "Booking with ID 'non-existent' not found"
}
```

---

### `POST /api/bookings`
Create a new booking reservation.

* **Request Headers:** `Content-Type: application/json`
* **Request Body:**
```json
{
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation"
}
```

* **Success Status:** `201 Created`
* **Response Body:**
```json
{
  "id": "bkg-1a2b3c4d",
  "equipmentId": "eq-1",
  "borrowerName": "Somchai Jaidee",
  "startAt": "2026-10-20T09:00:00.000Z",
  "endAt": "2026-10-20T11:00:00.000Z",
  "purpose": "Class presentation",
  "status": "CONFIRMED",
  "createdAt": "2026-10-06T06:35:00.000Z",
  "updatedAt": "2026-10-06T06:35:00.000Z"
}
```

* **Error Statuses:**
  * **`400 Bad Request`** (Missing or invalid data):
    ```json
    { "error": "All fields (equipmentId, borrowerName, startAt, endAt, purpose) are required non-empty strings" }
    ```
    ```json
    { "error": "startAt must be strictly earlier than endAt" }
    ```
    ```json
    { "error": "Equipment with ID 'eq-999' does not exist" }
    ```
  * **`409 Conflict`** (Booking overlap for the same equipment):
    ```json
    { "error": "Equipment 'eq-1' is already booked from 2026-10-20T09:00:00.000Z to 2026-10-20T11:00:00.000Z" }
    ```

---

### `PATCH /api/bookings/:id`
Update fields of an existing booking.

* **Request Headers:** `Content-Type: application/json`
* **Request Body (Partial or Full):**
```json
{
  "purpose": "Updated meeting purpose",
  "endAt": "2026-10-20T12:00:00.000Z"
}
```

* **Success Status:** `200 OK`
* **Error Statuses:**
  * **`400 Bad Request`**: Updated values are empty, invalid dates, startAt >= endAt, or referenced equipment does not exist.
  * **`404 Not Found`**: Booking with specified ID does not exist.
  * **`409 Conflict`**: New time range collides with another booking for the same equipment (excluding itself).

---

### `DELETE /api/bookings/:id`
Delete/cancel a booking record.

* **Success Status:** `204 No Content` (Empty response body)
* **Error Status:** `404 Not Found` if booking does not exist.

---

## 3. Global Error Format
All errors conform strictly to:
```json
{
  "error": "Descriptive message"
}
```
