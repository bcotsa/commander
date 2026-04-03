import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CommanderSearch } from '@/components/lobby/CommanderSearch'
import { ColorPips } from '@/components/ui/ColorPips'
import { useGameStore } from '@/store/game-store'
import { usePlayerStore } from '@/store/player-store'
import { useRoom } from '@/hooks/useRoom'
import { createPlayer } from '@/lib/game-reducer'
import type { CommanderCard } from '@/types/game-state'

export function Lobby() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { state, isHost } = useGameStore()
  const { id: playerId, name, setName } = usePlayerStore()
  const { sendAction } = useRoom(state.roomId || null)

  const [localName, setLocalName] = useState(name)
  const [joined, setJoined] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  function handleCopyCode() {
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const joinUrl = `${window.location.origin}/join/${code}`
  const myPlayer = state.players.find(p => p.id === playerId)

  // Join the room as a player
  useEffect(() => {
    if (joined || !state.roomId) return
    const seat = state.players.length
    const player = createPlayer(playerId, localName, seat)
    sendAction({ type: 'PLAYER_JOIN', player })
    setJoined(true)
  }, [state.roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNameChange() {
    if (!localName.trim()) return
    setName(localName)
    sendAction({ type: 'SET_PLAYER_NAME', playerId, name: localName })
  }

  function handleCommanderSelect(card: CommanderCard) {
    sendAction({ type: 'SET_COMMANDER', playerId, commander: card })
  }

  function handleStartGame() {
    if (!isHost) return
    sendAction({ type: 'GAME_START' })
    navigate(`/game/${code}`)
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Waiting for players</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-slate-400 text-sm">Room code:</span>
            <button
              onClick={handleCopyCode}
              className="font-mono font-bold text-lg tracking-widest text-violet-400 hover:text-violet-300 active:scale-95 transition-all"
              title="Click to copy"
            >
              {code}
            </button>
            {codeCopied && <span className="text-xs text-green-400">Copied!</span>}
          </div>
        </div>
        <button
          onClick={() => setShowQr(s => !s)}
          className="bg-slate-800 p-2 rounded-xl text-slate-400 hover:text-white"
          aria-label="Show QR code"
        >
          📱
        </button>
      </div>

      {/* QR Code */}
      {showQr && (
        <div className="flex flex-col items-center gap-2 p-4 bg-white rounded-2xl">
          <QRCodeSVG value={joinUrl} size={180} />
          <p className="text-slate-800 text-sm font-medium break-all text-center">{joinUrl}</p>
        </div>
      )}

      {/* My setup */}
      <div className="flex flex-col gap-4 bg-slate-800/50 rounded-2xl p-4 border border-slate-700">
        <h2 className="font-semibold text-slate-300">Your Setup</h2>

        <div className="flex gap-2">
          <Input
            placeholder="Your name"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={handleNameChange}
            onKeyDown={e => e.key === 'Enter' && handleNameChange()}
            className="flex-1"
          />
        </div>

        <div>
          <p className="text-sm text-slate-400 mb-2">Commander</p>
          <CommanderSearch
            onSelect={handleCommanderSelect}
            selected={myPlayer?.commander}
          />
        </div>
      </div>

      {/* Players list */}
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold text-slate-300">Players ({state.players.length})</h2>
        {state.players.map(p => (
          <div key={p.id} className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700">
            <div className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{p.name || `Player ${p.seat + 1}`}</div>
              {p.commander && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  {p.commander.name}
                  <ColorPips colors={p.commander.colorIdentity} />
                </div>
              )}
            </div>
            {p.id === state.players[0]?.id && (
              <span className="text-xs bg-violet-800 text-violet-300 px-2 py-0.5 rounded-full">Host</span>
            )}
            {p.id === playerId && (
              <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">You</span>
            )}
          </div>
        ))}
      </div>

      {/* Start game (host only) */}
      {isHost && (
        <Button
          size="lg"
          onClick={handleStartGame}
          disabled={state.players.length < 2}
          className="w-full"
        >
          Start Game →
        </Button>
      )}

      {!isHost && (
        <p className="text-center text-slate-500 text-sm">Waiting for host to start…</p>
      )}
    </div>
  )
}
