import { useEffect, useRef, useCallback, useState } from 'react'
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

  // BUG FIX 1: Keep a ref to always-current state so broadcast handlers
  // never use stale closure values.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // Track subscription readiness so callers can delay actions until ready.
  const [subscribed, setSubscribed] = useState(false)

  // Keep isHost in a ref too so the broadcast handler always has the latest value.
  const isHostRef = useRef(isHost)
  useEffect(() => { isHostRef.current = isHost }, [isHost])

  const broadcastAction = useCallback(
    (action: ActionPayload) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'ACTION',
        payload: { event: 'ACTION', payload: action, senderId: playerId, seq: stateRef.current.actionSeq + 1 },
      })
    },
    [playerId]
  )

  const broadcastState = useCallback(
    (nextState: GameState) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'STATE_SYNC',
        payload: { event: 'STATE_SYNC', payload: nextState, senderId: playerId, seq: nextState.actionSeq },
      })
      const hostId = useGameStore.getState().hostId
      if (roomId && hostId) persistState(roomId, nextState, hostId).catch(console.error)
    },
    [playerId, roomId]
  )

  const sendAction = useCallback(
    (action: ActionPayload) => {
      dispatch(action) // optimistic local update
      if (isHostRef.current) {
        // BUG FIX 1: use stateRef.current, not the stale closure value
        const nextState = gameReducer(stateRef.current, action)
        broadcastState(nextState)
      } else {
        broadcastAction(action)
      }
    },
    [dispatch, broadcastState, broadcastAction]
  )

  useEffect(() => {
    if (!roomId) return

    setSubscribed(false)

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    })

    channel
      .on('broadcast', { event: 'ACTION' }, ({ payload }: { payload: BroadcastMessage }) => {
        if (!isHostRef.current) return
        // BUG FIX 1: always use stateRef.current — never the stale closure
        const action = payload.payload as ActionPayload
        const nextState = gameReducer(stateRef.current, action)
        setState(nextState)
        broadcastState(nextState)

        const winner = getWinner(nextState)
        if (winner) {
          const name = nextState.players.find(p => p.id === winner)?.name ?? 'Someone'
          showToast(`🏆 ${name} wins!`)
        }
      })
      .on('broadcast', { event: 'STATE_SYNC' }, ({ payload }: { payload: BroadcastMessage }) => {
        if (isHostRef.current) return
        setState(payload.payload as GameState)
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
          // BUG FIX 2: signal that the channel is ready before anyone sends actions
          setSubscribed(true)
        }
      })

    channelRef.current = channel

    return () => {
      setSubscribed(false)
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [roomId, playerId]) // intentionally omit isHost — we use isHostRef instead

  return { sendAction, subscribed }
}
