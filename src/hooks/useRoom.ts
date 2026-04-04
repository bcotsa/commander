import { useEffect, useRef, useCallback, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { persistState } from '@/lib/room'
import { useGameStore } from '@/store/game-store'
import { usePlayerStore } from '@/store/player-store'
import { gameReducer } from '@/lib/game-reducer'
import { getWinner } from '@/lib/game-engine'
import { useUiStore } from '@/store/ui-store'
import type { ActionPayload, GameState } from '@/types/game-state'

/**
 * Core multiplayer hook. Manages Supabase realtime channel, dispatching,
 * and state synchronization.
 *
 * KEY DESIGN: All state reads use `useGameStore.getState()` directly instead
 * of React refs or closures. Zustand's getState() always returns the latest
 * committed state, eliminating the stale-closure bugs that caused player
 * data to be wiped when a second player joined.
 */
export function useRoom(roomId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const playerId = usePlayerStore(s => s.id)
  const showToast = useUiStore(s => s.showToast)
  const [subscribed, setSubscribed] = useState(false)

  const sendAction = useCallback(
    (action: ActionPayload) => {
      const store = useGameStore.getState()

      if (store.isHost) {
        // Host: compute new state once, update store, broadcast to clients
        const nextState = gameReducer(store.state, action)
        store.setState(nextState)

        channelRef.current?.send({
          type: 'broadcast',
          event: 'STATE_SYNC',
          payload: { event: 'STATE_SYNC', payload: nextState, senderId: playerId, seq: nextState.actionSeq },
        })
        if (roomId && store.hostId) {
          persistState(roomId, nextState, store.hostId).catch(console.error)
        }
      } else {
        // Non-host: optimistic local update, then send action to host
        store.dispatch(action)
        channelRef.current?.send({
          type: 'broadcast',
          event: 'ACTION',
          payload: { event: 'ACTION', payload: action, senderId: playerId, seq: store.state.actionSeq + 1 },
        })
      }
    },
    [playerId, roomId]
  )

  useEffect(() => {
    if (!roomId) return

    setSubscribed(false)

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'ACTION' }, ({ payload }) => {
        // Only the host processes incoming actions
        const store = useGameStore.getState()
        if (!store.isHost) return

        const action = (payload as { payload: ActionPayload }).payload
        const nextState = gameReducer(store.state, action)
        store.setState(nextState)

        // Broadcast authoritative state to all clients
        channelRef.current?.send({
          type: 'broadcast',
          event: 'STATE_SYNC',
          payload: { event: 'STATE_SYNC', payload: nextState, senderId: playerId, seq: nextState.actionSeq },
        })
        if (roomId && store.hostId) {
          persistState(roomId, nextState, store.hostId).catch(console.error)
        }

        const winner = getWinner(nextState)
        if (winner) {
          const name = nextState.players.find(p => p.id === winner)?.name ?? 'Someone'
          showToast(`🏆 ${name} wins!`)
        }
      })
      .on('broadcast', { event: 'STATE_SYNC' }, ({ payload }) => {
        const store = useGameStore.getState()
        if (store.isHost) return
        store.setState((payload as { payload: GameState }).payload)
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        newPresences.forEach((p) => {
          const pid = (p as Record<string, unknown>)['player_id'] as string | undefined
          if (pid) useGameStore.getState().dispatch({ type: 'PLAYER_CONNECTED', playerId: pid, connected: true })
        })
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach((p) => {
          const pid = (p as Record<string, unknown>)['player_id'] as string | undefined
          if (pid) useGameStore.getState().dispatch({ type: 'PLAYER_CONNECTED', playerId: pid, connected: false })
        })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ player_id: playerId })
          setSubscribed(true)
        }
      })

    channelRef.current = channel

    return () => {
      setSubscribed(false)
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, playerId, showToast])

  return { sendAction, subscribed }
}
