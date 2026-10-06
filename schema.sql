-- Campus Equipment Booking Database Schema (SQLite / Cloudflare D1)

-- 1. Equipment Table
CREATE TABLE IF NOT EXISTS equipment (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    equipmentId TEXT NOT NULL,
    borrowerName TEXT NOT NULL,
    startAt TEXT NOT NULL,
    endAt TEXT NOT NULL,
    purpose TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (equipmentId) REFERENCES equipment(id) ON DELETE RESTRICT
);

-- Index for fast lookup and overlapping booking checks
CREATE INDEX IF NOT EXISTS idx_bookings_lookup ON bookings (equipmentId, startAt, endAt);

-- 3. Seed Equipment Records (At least 2 records required by brief)
INSERT OR IGNORE INTO equipment (id, name, location, category) VALUES
    ('eq-1', 'Projector A', 'Building 1', 'Projector'),
    ('eq-2', 'Sony Alpha 7 IV Camera', 'Media Center, Room 204', 'Camera'),
    ('eq-3', 'Meeting Room 301', 'Building 3, 3rd Floor', 'Room');
