import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CommanderSearch } from '@/components/lobby/CommanderSearch'
import { MoxfieldImport } from '@/components/lobby/MoxfieldImport'
import { ColorPips } from '@/components/ui/ColorPips'
import { useGameStore } from '@/store/game-store'
import { usePlayerStore } from '@/store/player-store'
import { useUiStore } from '@/store/ui-store'
import { useRoom } from '@/hooks/useRoom'
import { createPlayer } from '@/lib/game-reducer'
import { importDecklistText } from '@/lib/scryfall'
import { BLIGHT_TEST_DECK, SQUIRREL_TEST_DECK, TEST_FAKE_PLAYER_ID } from '@/lib/test-decks'
import type { CommanderCard } from '@/types/game-state'

export function Lobby() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { state, isHost } = useGameStore()
  const { id: playerId, name, setName } = usePlayerStore()
  const showToast = useUiStore(s => s.showToast)
  // BUG FIX 2: get subscribed so we wait before sending PLAYER_JOIN
  const { sendAction, requestDeckImport, subscribed } = useRoom(state.roomId || null)

  const [localName, setLocalName] = useState(name)
  const [joined, setJoined] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [loadingTestMatch, setLoadingTestMatch] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(code ?? '').then(() => {
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    })
  }

  const joinUrl = `${window.location.origin}/join/${code}`
  const myPlayer = state.players.find(p => p.id === playerId)

  // BUG FIX 2: Wait until channel is subscribed before sending PLAYER_JOIN,
  // otherwise the message fires before Supabase is ready and gets dropped.
  useEffect(() => {
    if (!subscribed || joined || !state.roomId) return
    const seat = state.players.length
    const player = createPlayer(playerId, localName || `Player ${seat + 1}`, seat)
    sendAction({ type: 'PLAYER_JOIN', player })
    setJoined(true)
  }, [subscribed, state.roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // BUG FIX 3: Non-host players watch for game phase change and navigate
  // to the game page when the host starts the game.
  useEffect(() => {
    if (state.phase === 'active') {
      navigate(`/game/${code}`)
    }
  }, [state.phase, code, navigate])

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
    sendAction({ type: 'GAME_START', hostControlsAllPlayers: false })
    // Host navigation happens via the phase effect above (same as non-hosts)
  }

  async function handleLoadTestMatch() {
    if (!isHost || loadingTestMatch) return

    const realOtherPlayers = state.players.filter(p => p.id !== playerId && p.id !== TEST_FAKE_PLAYER_ID)
    if (realOtherPlayers.length > 0) {
      showToast('Test match only works when you are the only real player in the room.')
      return
    }

    setLoadingTestMatch(true)

    try {
      const fakeExists = state.players.some(p => p.id === TEST_FAKE_PLAYER_ID)
      if (!fakeExists) {
        const fakePlayer = createPlayer(TEST_FAKE_PLAYER_ID, 'Test Opponent', 1)
        sendAction({ type: 'PLAYER_JOIN', player: fakePlayer })
      }

      const [hostDeck, fakeDeck] = await Promise.all([
        importDecklistText(SQUIRREL_TEST_DECK),
        importDecklistText(BLIGHT_TEST_DECK),
      ])

      sendAction({ type: 'SET_DECK', playerId, deck: hostDeck.deck, commander: hostDeck.commander })
      sendAction({ type: 'SET_DECK', playerId: TEST_FAKE_PLAYER_ID, deck: fakeDeck.deck, commander: fakeDeck.commander })
      sendAction({ type: 'GAME_START', hostControlsAllPlayers: true })
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to load test match')
    } finally {
      setLoadingTestMatch(false)
    }
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
              onClick={copyCode}
              className="flex items-center gap-1.5 font-mono font-bold text-lg tracking-widest text-violet-400 hover:text-violet-300 transition-colors"
            >
              {code}
              <span className="text-xs font-normal tracking-normal text-slate-500">
                {codeCopied ? '✓ copied' : '📋'}
              </span>
            </button>
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

      {/* Connection status */}
      {!subscribed && (
        <div className="flex items-center gap-2 text-sm text-yellow-400">
          <span className="animate-pulse">●</span> Connecting…
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
          <p className="text-sm text-slate-400 mb-2">Deck</p>
          <MoxfieldImport
            onImportUrl={(input) => requestDeckImport({ source: 'moxfield', input })}
            onImportDecklist={(input) => requestDeckImport({ source: 'decklist', input })}
            selectedDeck={myPlayer?.deck}
          />
        </div>

        <div className="rounded-xl border border-dashed border-slate-600 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-200">Test Flow</p>
              <p className="mt-1 text-xs text-slate-400">
                Loads two hardcoded decks, creates a fake opponent, and auto-starts the game.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={() => void handleLoadTestMatch()}
              disabled={!isHost || loadingTestMatch || !subscribed}
            >
              {loadingTestMatch ? 'Loading…' : 'Load Test Match'}
            </Button>
          </div>
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
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.isConnected ? 'bg-green-400' : 'bg-slate-600'}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{p.name || `Player ${p.seat + 1}`}</div>
              {p.commander && (
                <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                  {p.commander.name}
                  <ColorPips colors={p.commander.colorIdentity} />
                </div>
              )}
              {p.deck && (
                <div className="text-xs text-slate-500 mt-1 truncate">
                  {p.deck.name} • {p.deck.cardCount} cards
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
          disabled={state.players.length < 2 || !subscribed}
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
