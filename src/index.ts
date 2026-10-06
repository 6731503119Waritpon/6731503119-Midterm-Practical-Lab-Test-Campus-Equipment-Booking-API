import { Hono } from 'hono';
import { cors } from 'hono/cors';

export type Bindings = {
  DB: D1Database;
};

export type Equipment = {
  id: string;
  name: string;
  location: string;
  category?: string;
  created_at?: string;
};

export type Booking = {
  id: string;
  equipmentId: string;
  borrowerName: string;
  startAt: string;
  endAt: string;
  purpose: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes (supports browser frontend tester and curl)
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Helper router to mount both at root (/) and (/api) to ensure compatibility
const api = new Hono<{ Bindings: Bindings }>();

// ---------------------------------------------------------------------------
// Health check / Root
// ---------------------------------------------------------------------------
api.get('/', (c) => {
  return c.json({
    name: 'Campus Equipment Booking API',
    studentId: '6731503119',
    status: 'online',
    endpoints: {
      equipment: '/equipment',
      bookings: '/bookings',
    },
  });
});

// ---------------------------------------------------------------------------
// 1. Equipment Resource
// ---------------------------------------------------------------------------
api.get('/equipment', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, location FROM equipment ORDER BY id ASC'
    ).all<Equipment>();

    return c.json(results ?? [], 200);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// 2. Bookings Resource: GET (List all bookings)
// ---------------------------------------------------------------------------
api.get('/bookings', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, status, createdAt, updatedAt FROM bookings ORDER BY startAt ASC'
    ).all<Booking>();

    return c.json(results ?? [], 200);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// 3. Bookings Resource: GET :id (Get single booking)
// ---------------------------------------------------------------------------
api.get('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const booking = await c.env.DB.prepare(
      'SELECT id, equipmentId, borrowerName, startAt, endAt, purpose, status, createdAt, updatedAt FROM bookings WHERE id = ?'
    )
      .bind(id)
      .first<Booking>();

    if (!booking) {
      return c.json({ error: `Booking with ID '${id}' not found` }, 404);
    }

    return c.json(booking, 200);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// 4. Bookings Resource: POST (Create a booking)
// ---------------------------------------------------------------------------
api.post('/bookings', async (c) => {
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  const { equipmentId, borrowerName, startAt, endAt, purpose } = body || {};

  // Validate presence and type of required fields
  if (
    !equipmentId || typeof equipmentId !== 'string' || equipmentId.trim() === '' ||
    !borrowerName || typeof borrowerName !== 'string' || borrowerName.trim() === '' ||
    !startAt || typeof startAt !== 'string' || startAt.trim() === '' ||
    !endAt || typeof endAt !== 'string' || endAt.trim() === '' ||
    !purpose || typeof purpose !== 'string' || purpose.trim() === ''
  ) {
    return c.json(
      { error: 'All fields (equipmentId, borrowerName, startAt, endAt, purpose) are required non-empty strings' },
      400
    );
  }

  // Validate ISO 8601 timestamps
  const startDate = new Date(startAt);
  const endDate = new Date(endAt);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return c.json({ error: 'startAt and endAt must be valid ISO 8601 date strings' }, 400);
  }

  // Business Rule: start time must be before end time
  if (startDate.getTime() >= endDate.getTime()) {
    return c.json({ error: 'startAt must be strictly earlier than endAt' }, 400);
  }

  try {
    // Business Rule: equipmentId must exist in equipment table
    const equipment = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
      .bind(equipmentId.trim())
      .first<{ id: string }>();

    if (!equipment) {
      return c.json({ error: `Equipment with ID '${equipmentId}' does not exist` }, 400);
    }

    // Business Rule: Bookings for the same equipment must not overlap (409 Conflict)
    // Overlap condition: existing.startAt < new.endAt AND existing.endAt > new.startAt
    const conflictingBooking = await c.env.DB.prepare(
      `SELECT id, borrowerName, startAt, endAt FROM bookings
       WHERE equipmentId = ?
         AND status != 'CANCELLED'
         AND startAt < ?
         AND endAt > ?
       LIMIT 1`
    )
      .bind(equipmentId.trim(), endAt.trim(), startAt.trim())
      .first<Booking>();

    if (conflictingBooking) {
      return c.json(
        {
          error: `Equipment '${equipmentId}' is already booked from ${conflictingBooking.startAt} to ${conflictingBooking.endAt}`,
        },
        409
      );
    }

    // Insert new booking
    const newId = `bkg-${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO bookings (id, equipmentId, borrowerName, startAt, endAt, purpose, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?)`
    )
      .bind(
        newId,
        equipmentId.trim(),
        borrowerName.trim(),
        startAt.trim(),
        endAt.trim(),
        purpose.trim(),
        nowIso,
        nowIso
      )
      .run();

    const createdBooking = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(newId)
      .first<Booking>();

    return c.json(createdBooking, 201);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// 5. Bookings Resource: PATCH :id (Update a booking)
// ---------------------------------------------------------------------------
api.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id');

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  try {
    // 1. Check if the booking exists
    const existing = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(id)
      .first<Booking>();

    if (!existing) {
      return c.json({ error: `Booking with ID '${id}' not found` }, 404);
    }

    // Determine target values
    const targetEquipmentId = body.equipmentId !== undefined ? String(body.equipmentId).trim() : existing.equipmentId;
    const targetBorrowerName = body.borrowerName !== undefined ? String(body.borrowerName).trim() : existing.borrowerName;
    const targetStartAt = body.startAt !== undefined ? String(body.startAt).trim() : existing.startAt;
    const targetEndAt = body.endAt !== undefined ? String(body.endAt).trim() : existing.endAt;
    const targetPurpose = body.purpose !== undefined ? String(body.purpose).trim() : existing.purpose;

    // Validate non-empty strings if provided
    if (
      targetEquipmentId === '' ||
      targetBorrowerName === '' ||
      targetStartAt === '' ||
      targetEndAt === '' ||
      targetPurpose === ''
    ) {
      return c.json({ error: 'Updated fields must not be empty strings' }, 400);
    }

    // If equipmentId changed, verify it exists
    if (body.equipmentId !== undefined) {
      const eqExists = await c.env.DB.prepare('SELECT id FROM equipment WHERE id = ?')
        .bind(targetEquipmentId)
        .first<{ id: string }>();

      if (!eqExists) {
        return c.json({ error: `Equipment with ID '${targetEquipmentId}' does not exist` }, 400);
      }
    }

    // Validate timestamps
    const startDate = new Date(targetStartAt);
    const endDate = new Date(targetEndAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return c.json({ error: 'startAt and endAt must be valid ISO 8601 date strings' }, 400);
    }

    if (startDate.getTime() >= endDate.getTime()) {
      return c.json({ error: 'startAt must be strictly earlier than endAt' }, 400);
    }

    // Check for overlapping bookings (excluding this booking itself)
    const conflictingBooking = await c.env.DB.prepare(
      `SELECT id, borrowerName, startAt, endAt FROM bookings
       WHERE equipmentId = ?
         AND id != ?
         AND status != 'CANCELLED'
         AND startAt < ?
         AND endAt > ?
       LIMIT 1`
    )
      .bind(targetEquipmentId, id, targetEndAt, targetStartAt)
      .first<Booking>();

    if (conflictingBooking) {
      return c.json(
        {
          error: `Equipment '${targetEquipmentId}' is already booked for an overlapping time (${conflictingBooking.startAt} to ${conflictingBooking.endAt})`,
        },
        409
      );
    }

    // Execute update
    const nowIso = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE bookings
       SET equipmentId = ?, borrowerName = ?, startAt = ?, endAt = ?, purpose = ?, updatedAt = ?
       WHERE id = ?`
    )
      .bind(
        targetEquipmentId,
        targetBorrowerName,
        targetStartAt,
        targetEndAt,
        targetPurpose,
        nowIso,
        id
      )
      .run();

    const updated = await c.env.DB.prepare('SELECT * FROM bookings WHERE id = ?')
      .bind(id)
      .first<Booking>();

    return c.json(updated, 200);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// ---------------------------------------------------------------------------
// 6. Bookings Resource: DELETE :id (Delete a booking)
// ---------------------------------------------------------------------------
api.delete('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const existing = await c.env.DB.prepare('SELECT id FROM bookings WHERE id = ?')
      .bind(id)
      .first<{ id: string }>();

    if (!existing) {
      return c.json({ error: `Booking with ID '${id}' not found` }, 404);
    }

    await c.env.DB.prepare('DELETE FROM bookings WHERE id = ?')
      .bind(id)
      .run();

    // 204 No Content
    return c.body(null, 204);
  } catch (err: any) {
    return c.json({ error: `Database error: ${err.message}` }, 500);
  }
});

// Mount routes at both /api and root /
app.route('/api', api);
app.route('/', api);

// Custom 404 Handler
app.notFound((c) => {
  return c.json({ error: `Route not found: ${c.req.method} ${c.req.path}` }, 404);
});

// Custom 500 Handler
app.onError((err, c) => {
  return c.json({ error: err.message || 'Internal server error' }, 500);
});

export default app;

