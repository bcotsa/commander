import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PlayerGrid } from '@/components/game/PlayerGrid'
import { StackPanel } from '@/components/game/StackPanel'
import { TurnTracker } from '@/components/game/TurnTracker'
import { CommanderDamageModal } from '@/components/modals/CommanderDamageModal'
import { CountersModal } from '@/components/modals/CountersModal'
import { DiceRollerModal } from '@/components/modals/DiceRollerModal'
import { GameLogModal } from '@/components/modals/GameLogModal'
import { CardLookupModal } from '@/components/modals/CardLookupModal'
import { Toast } from '@/components/ui/Toast'
import { useGameStore } from '@/store/game-store'
import { usePlayerStore } from '@/store/player-store'
import { useUiStore } from '@/store/ui-store'
import { useRoom } from '@/hooks/useRoom'
import { getWinner } from '@/lib/game-engine'
import type { PlayerCounters } from '@/types/game-state'

export function Game() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()

  const { state, isHost } = useGameStore()
  const myPlayerId = usePlayerStore(s => s.id)
  const { activeModal, modalTargetPlayerId, openModal, closeModal, showToast } = useUiStore()
  const { sendAction } = useRoom(state.roomId || null)

  const currentTurnPlayerId = state.turnOrder[state.currentTurnIndex] ?? null
  const targetPlayer = state.players.find(p => p.id === modalTargetPlayerId) ?? null
  const winner = getWinner(state)

  // Redirect if state not loaded
  useEffect(() => {
    if (!state.roomId && !code) navigate('/')
  }, [state.roomId, code, navigate])

  // Announce winner
  useEffect(() => {
    if (winner) {
      const name = state.players.find(p => p.id === winner)?.name ?? 'Someone'
      showToast(`🏆 ${name} wins!`)
    }
  }, [winner]) // eslint-disable-line react-hooks/exhaustive-deps

  const canUndo = state.log.some(e => e.undoable)

  return (
    <div className="h-screen flex flex-col bg-slate-950 overflow-hidden">
      {/* Turn tracker */}
      <TurnTracker
        players={state.players}
        turnOrder={state.turnOrder}
        currentTurnIndex={state.currentTurnIndex}
        currentPhase={state.currentPhase}
        stackCount={state.stack.length}
        priorityPlayerId={state.priorityPlayerId}
        myPlayerId={myPlayerId}
        round={state.round}
        onNextStep={() => sendAction({ type: 'NEXT_STEP' })}
        onPassPriority={(pid) => sendAction({ type: 'PASS_PRIORITY', playerId: pid })}
        onResolveCombat={() => sendAction({ type: 'RESOLVE_COMBAT' })}
        isHost={isHost}
      />

      <StackPanel
        stack={state.stack}
        players={state.players}
        priorityPlayerId={state.priorityPlayerId}
        passedIds={state.priorityPassedIds}
      />

      {/* Player grid — fills remaining space */}
      <div className="flex-1 min-h-0">
        <PlayerGrid
          players={state.players}
          currentTurnPlayerId={currentTurnPlayerId}
          currentPhase={state.currentPhase}
          combat={state.combat}
          onLifeDelta={(pid, delta) => sendAction({ type: 'LIFE_CHANGE', targetId: pid, delta })}
          onDrawCard={(pid) => sendAction({ type: 'DRAW_CARD', playerId: pid })}
          onMoveCard={(pid, from, to, cardId) => sendAction({ type: 'MOVE_CARD', playerId: pid, from, to, cardId })}
          onToggleTapped={(pid, cardId) => sendAction({ type: 'TOGGLE_CARD_TAPPED', playerId: pid, cardId })}
          onAddMana={(pid, cardId, color) => sendAction({ type: 'ADD_MANA', playerId: pid, cardId, color })}
          onPlayLand={(pid, cardId) => sendAction({ type: 'PLAY_LAND', playerId: pid, cardId })}
          onCastCommander={(pid, cardId) => sendAction({ type: 'CAST_COMMANDER', playerId: pid, cardId })}
          onCastPermanent={(pid, cardId) => sendAction({ type: 'CAST_PERMANENT', playerId: pid, cardId })}
          onCastSpell={(pid, cardId, targetCardId, targetPlayerId) => sendAction({ type: 'CAST_SPELL', playerId: pid, cardId, targetCardId, targetPlayerId })}
          onDeclareAttacker={(pid, cardId, defendingPlayerId) => sendAction({ type: 'DECLARE_ATTACKER', playerId: pid, cardId, defendingPlayerId })}
          onRemoveAttacker={(pid, cardId) => sendAction({ type: 'REMOVE_ATTACKER', playerId: pid, cardId })}
          onAssignBlocker={(pid, blockerId, attackerId) => sendAction({ type: 'ASSIGN_BLOCKER', playerId: pid, blockerId, attackerId })}
          onRemoveBlocker={(pid, blockerId, attackerId) => sendAction({ type: 'REMOVE_BLOCKER', playerId: pid, blockerId, attackerId })}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-around px-3 py-2 bg-slate-900 border-t border-slate-700">
        <button onClick={() => openModal('diceRoller')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-1">
          <span className="text-xl">🎲</span>
          <span className="text-xs">Dice</span>
        </button>
        <button onClick={() => openModal('cardLookup')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-1">
          <span className="text-xl">🔍</span>
          <span className="text-xs">Cards</span>
        </button>
        <button onClick={() => openModal('gameLog')} className="relative flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-1">
          <span className="text-xl">📜</span>
          <span className="text-xs">Log</span>
          {canUndo && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-violet-500 rounded-full" />}
        </button>
        <button
          onClick={() => {
            if (confirm('Reset all life totals?')) {
              sendAction({ type: 'RESET_GAME' })
            }
          }}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-1"
        >
          <span className="text-xl">🔄</span>
          <span className="text-xs">Reset</span>
        </button>
        <button onClick={() => navigate('/')} className="flex flex-col items-center gap-1 text-slate-400 hover:text-white transition-colors px-3 py-1">
          <span className="text-xl">🚪</span>
          <span className="text-xs">Leave</span>
        </button>
      </div>

      {/* Modals */}
      <CommanderDamageModal
        open={activeModal === 'commanderDamage'}
        onClose={closeModal}
        targetPlayer={targetPlayer}
        allPlayers={state.players}
        onDamage={(fromId, toId, delta) =>
          sendAction({ type: 'COMMANDER_DAMAGE', fromId, toId, delta })
        }
      />

      <CountersModal
        open={activeModal === 'counters'}
        onClose={closeModal}
        targetPlayer={targetPlayer}
        allPlayers={state.players}
        onCounterChange={(pid, counter, delta) =>
          sendAction({ type: 'COUNTER_CHANGE', targetId: pid, counter: counter as keyof PlayerCounters, delta })
        }
        onSetMonarch={(pid) => sendAction({ type: 'SET_MONARCH', playerId: pid })}
        onSetInitiative={(pid) => sendAction({ type: 'SET_INITIATIVE', playerId: pid })}
      />

      <DiceRollerModal
        open={activeModal === 'diceRoller'}
        onClose={closeModal}
      />

      <GameLogModal
        open={activeModal === 'gameLog'}
        onClose={closeModal}
        log={state.log}
        onUndo={() => { sendAction({ type: 'UNDO' }); closeModal() }}
        canUndo={canUndo}
      />

      <CardLookupModal
        open={activeModal === 'cardLookup'}
        onClose={closeModal}
      />

      <Toast />
    </div>
  )
}
