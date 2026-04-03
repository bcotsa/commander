import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { createRoom, joinRoom } from '@/lib/room'
import { usePlayerStore } from '@/store/player-store'
import { useGameStore } from '@/store/game-store'

export function Home() {
  const navigate = useNavigate()
  const playerId = usePlayerStore(s => s.id)
  const setIdentity = useGameStore(s => s.setIdentity)
  const setState = useGameStore(s => s.setState)

  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')

  async function handleCreate() {
    setLoading('create')
    setError('')
    try {
      const room = await createRoom(playerId)
      setIdentity(playerId, playerId)
      setState(room.state)
      navigate(`/lobby/${room.code}`)
    } catch (e) {
      setError('Failed to create room. Check your connection.')
    } finally {
      setLoading(null)
    }
  }

  async function handleJoin() {
    if (!joinCode.trim()) return
    setLoading('join')
    setError('')
    try {
      const room = await joinRoom(joinCode.trim())
      setIdentity(room.host_id, playerId)
      setState(room.state)
      navigate(`/lobby/${room.code}`)
    } catch (e) {
      setError('Room not found or expired.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-8">
      {/* Logo / Title */}
      <div className="text-center">
        <div className="text-6xl mb-3">⚔️</div>
        <h1 className="text-4xl font-black tracking-tight">Commander</h1>
        <p className="text-slate-400 mt-2">MTG life tracker for you and your playgroup</p>
      </div>

      {/* Create */}
      <div className="w-full max-w-sm flex flex-col gap-4">
        <Button size="lg" onClick={handleCreate} disabled={loading !== null} className="w-full">
          {loading === 'create' ? <Spinner size="sm" /> : '+ Create New Game'}
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-slate-500 text-sm">or join</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Room code (e.g. GRN7KQ)"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleJoin()}
            className="flex-1 uppercase tracking-widest"
            maxLength={6}
          />
          <Button onClick={handleJoin} disabled={loading !== null || !joinCode.trim()}>
            {loading === 'join' ? <Spinner size="sm" /> : 'Join'}
          </Button>
        </div>

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      </div>

      <p className="text-xs text-slate-600 text-center">
        Rooms expire after 12 hours
      </p>
    </div>
  )
}
