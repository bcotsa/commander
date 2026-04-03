import { supabase, supabaseAsHost } from './supabase'
import { createInitialGameState } from './game-reducer'
import type { GameState, RoomRecord } from '@/types/game-state'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars

function generateCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export async function createRoom(hostId: string): Promise<RoomRecord> {
  let code = generateCode()
  let attempts = 0

  while (attempts < 5) {
    // Pre-generate the UUID so the state's roomId is set correctly from the start
    const id = crypto.randomUUID()
    const state = createInitialGameState(code, id)
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('rooms')
      .insert({ id, code, host_id: hostId, state, expires_at: expiresAt })
      .select()
      .single()

    if (!error && data) return data as RoomRecord

    // Retry on unique violation (code collision)
    if (error?.code === '23505') {
      code = generateCode()
      attempts++
      continue
    }

    throw new Error(error?.message ?? 'Failed to create room')
  }

  throw new Error('Could not generate unique room code')
}

export async function joinRoom(code: string): Promise<RoomRecord> {
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error || !data) throw new Error('Room not found or expired')
  const record = data as RoomRecord
  // Ensure state.roomId is always set, even for rooms created before this fix
  if (!record.state.roomId) {
    record.state = { ...record.state, roomId: record.id }
  }
  return record
}

export async function persistState(roomId: string, state: GameState, hostId: string): Promise<void> {
  const { error } = await supabaseAsHost(hostId)
    .from('rooms')
    .update({ state })
    .eq('id', roomId)

  if (error) throw new Error(`Failed to persist state: ${error.message}`)
}

export async function transferHost(roomId: string, currentHostId: string, newHostId: string): Promise<void> {
  const { error } = await supabaseAsHost(currentHostId)
    .from('rooms')
    .update({ host_id: newHostId })
    .eq('id', roomId)

  if (error) throw new Error(`Failed to transfer host: ${error.message}`)
}
