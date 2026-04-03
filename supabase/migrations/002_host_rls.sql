-- Migration: Tighten RLS so only the room host can update/delete
-- The host_id is passed via the x-host-id custom request header.

-- Drop the old permissive update policy
DROP POLICY IF EXISTS "rooms_update" ON rooms;

-- Only the host can update their own room
CREATE POLICY "rooms_update" ON rooms FOR UPDATE
  USING (
    host_id = current_setting('request.headers', true)::json->>'x-host-id'
  );

-- Only the host can delete their own room
DROP POLICY IF EXISTS "rooms_delete" ON rooms;
CREATE POLICY "rooms_delete" ON rooms FOR DELETE
  USING (
    host_id = current_setting('request.headers', true)::json->>'x-host-id'
  );
