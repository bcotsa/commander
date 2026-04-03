import { createClient } from '@supabase/supabase-js'
import type { RoomRecord } from '@/types/game-state'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set — realtime sync disabled. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
}

export const supabase = createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey ?? 'placeholder')

/**
 * Returns a Supabase client scoped with an x-host-id header.
 * Supabase RLS policies use this header to verify that only
 * the room host can update or delete a room.
 */
export function supabaseAsHost(hostId: string) {
  return createClient(supabaseUrl ?? 'https://placeholder.supabase.co', supabaseAnonKey ?? 'placeholder', {
    global: {
      headers: { 'x-host-id': hostId },
    },
  })
}

export type Database = {
  public: {
    Tables: {
      rooms: {
        Row: RoomRecord
        Insert: Omit<RoomRecord, 'created_at'>
        Update: Partial<Omit<RoomRecord, 'id' | 'created_at'>>
      }
    }
  }
}
