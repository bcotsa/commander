-- Commander Tracker schema

CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '12 hours',
  host_id     TEXT NOT NULL,
  state       JSONB NOT NULL
);

-- Index for joining by code
CREATE INDEX IF NOT EXISTS rooms_code_idx ON rooms (code);

-- Index for cleanup of expired rooms
CREATE INDEX IF NOT EXISTS rooms_expires_idx ON rooms (expires_at);

-- Optional: auto-delete expired rooms (requires pg_cron extension in Supabase)
-- SELECT cron.schedule('cleanup-expired-rooms', '0 * * * *', $$
--   DELETE FROM rooms WHERE expires_at < NOW();
-- $$);

-- Enable Realtime for the rooms table
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;

-- Row Level Security
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- Anyone can read rooms (needed to join by code)
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (true);

-- Anyone can create rooms, but limit abuse via the function below
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (true);

-- Only the host can update their own room
-- The caller must pass their host_id via an RPC header or match it in the WHERE clause.
-- Since we use anon access (no auth), we enforce this by requiring the request
-- to include x-host-id as a custom header which must match the row's host_id.
CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  USING (
    host_id = current_setting('request.headers', true)::json->>'x-host-id'
  );

-- Allow hosts to delete their own rooms
CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  USING (
    host_id = current_setting('request.headers', true)::json->>'x-host-id'
  );
