import { useEffect, useRef, useCallback } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { persistState } from '@/lib/room'
import { useGameStore } from '@/store/game-store'
import { usePlayerStore } from '@/store/player-store'
import { gameReducer } from '@/lib/game-reducer'
import { getWinner } from '@/lib/game-engine'
import { useUiStore } from '@/store/ui-store'
import type { BroadcastMessage, ActionPayload, GameState } from '@/types/game-state'

export function useRoom(roomId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const { state, setState, dispatch, isHost } = useGameStore()
  const playerId = usePlayerStore(s => s.id)
  const showToast = useUiStore(s => s.showToast)

  // Broadcast an action to the channel
  const broadcastAction = useCallback(
    (action: ActionPayload) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'ACTION',
        payload: { event: 'ACTION', payload: action, senderId: playerId, seq: state.actionSeq + 1 },
      })
    },
    [playerId, state.actionSeq]
  )

  // Host broadcasts full state to all clients
  const broadcastState = useCallback(
    (nextState: GameState) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'STATE_SYNC',
        payload: { event: 'STATE_SYNC', payload: nextState, senderId: playerId, seq: nextState.actionSeq },
      })
      if (roomId) persistState(roomId, nextState, playerId).catch(console.error)
    },
    [playerId, roomId]
  )

  // Public dispatch: optimistic locally + broadcast
  const sendAction = useCallback(
    (action: ActionPayload) => {
      dispatch(action) // optimistic
      if (isHost) {
        const nextState = gameReducer(state, action)
        broadcastState(nextState)
      } else {
        broadcastAction(action)
      }
    },
    [dispatch, isHost, state, broadcastState, broadcastAction]
  )

  useEffect(() => {
    if (!roomId) return

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'ACTION' }, ({ payload }: { payload: BroadcastMessage }) => {
        if (isHost) {
          // Host applies the action and re-broadcasts authoritative state
          const action = payload.payload as ActionPayload
          const nextState = gameReducer(state, action)
          setState(nextState)
          broadcastState(nextState)

          const winner = getWinner(nextState)
          if (winner) {
            const name = nextState.players.find(p => p.id === winner)?.name ?? 'Someone'
            showToast(`${name} wins!`)
          }
        }
      })
      .on('broadcast', { event: 'STATE_SYNC' }, ({ payload }: { payload: BroadcastMessage }) => {
        if (!isHost) {
          setState(payload.payload as GameState)
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p) => {
          const pid = (p as Record<string, unknown>)['player_id'] as string | undefined
          if (pid) dispatch({ type: 'PLAYER_CONNECTED', playerId: pid, connected: true })
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p) => {
          const pid = (p as Record<string, unknown>)['player_id'] as string | undefined
          if (pid) dispatch({ type: 'PLAYER_CONNECTED', playerId: pid, connected: false })
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: playerId })
        }
      })

    channelRef.current = channel

    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost, playerId])

  return { sendAction }
}
