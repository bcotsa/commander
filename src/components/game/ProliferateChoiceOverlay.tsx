import { useMemo, useState } from 'react'
import type { Player, ProliferateChoiceState } from '@/types/game-state'

interface ProliferateChoiceOverlayProps {
  choice: ProliferateChoiceState
  players: Player[]
  myPlayerId: string
  canControlAllPlayers: boolean
  onConfirm: (targetPlayerIds: string[], targetCardIds: string[]) => void
}

export function ProliferateChoiceOverlay({
  choice,
  players,
  myPlayerId,
  canControlAllPlayers,
  onConfirm,
}: ProliferateChoiceOverlayProps) {
  const canAct = canControlAllPlayers || choice.playerId === myPlayerId
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])

  const playerTargets = useMemo(
    () => players.filter(player => {
      const counters = player.counters
      return counters.poison > 0 || counters.experience > 0 || counters.energy > 0 || counters.storm > 0
    }),
    [players]
  )

  const cardTargets = useMemo(
    () => players.flatMap(player =>
      player.zones.battlefield
        .filter(card => card.plusOneCounters > 0 || card.minusOneCounters > 0 || (card.loyalty ?? 0) > 0)
        .map(card => ({ player, card }))
    ),
    [players]
  )

  function togglePlayer(playerId: string) {
    setSelectedPlayerIds(current =>
      current.includes(playerId) ? current.filter(id => id !== playerId) : [...current, playerId]
    )
  }

  function toggleCard(cardId: string) {
    setSelectedCardIds(current =>
      current.includes(cardId) ? current.filter(id => id !== cardId) : [...current, cardId]
    )
  }

  return (
    <div className="absolute inset-0 z-30 bg-slate-950/90 backdrop-blur-sm p-4">
      <div className="mx-auto flex h-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="border-b border-slate-700 px-5 py-4">
          <div className="text-lg font-semibold text-white">Proliferate</div>
          <div className="mt-1 text-sm text-slate-400">
            {choice.sourceName}: choose any number of players and permanents with counters
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Players</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {playerTargets.length > 0 ? playerTargets.map(player => (
                <button
                  key={player.id}
                  type="button"
                  disabled={!canAct}
                  onClick={() => togglePlayer(player.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    selectedPlayerIds.includes(player.id)
                      ? 'border-emerald-500 bg-emerald-500/10 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  <div className="font-medium">{player.name || `Player ${player.seat + 1}`}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {[
                      player.counters.poison > 0 ? `Poison ${player.counters.poison}` : null,
                      player.counters.experience > 0 ? `Experience ${player.counters.experience}` : null,
                      player.counters.energy > 0 ? `Energy ${player.counters.energy}` : null,
                      player.counters.storm > 0 ? `Storm ${player.counters.storm}` : null,
                    ].filter(Boolean).join(' • ')}
                  </div>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-500">
                  No players have counters
                </div>
              )}
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Permanents</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {cardTargets.length > 0 ? cardTargets.map(({ player, card }) => (
                <button
                  key={card.instanceId}
                  type="button"
                  disabled={!canAct}
                  onClick={() => toggleCard(card.instanceId)}
                  className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                    selectedCardIds.includes(card.instanceId)
                      ? 'border-violet-500 bg-violet-500/10 text-white'
                      : 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  } disabled:opacity-50`}
                >
                  <div className="font-medium">{card.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{player.name || `Player ${player.seat + 1}`}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {[
                      card.plusOneCounters > 0 ? `+1/+1 ${card.plusOneCounters}` : null,
                      card.minusOneCounters > 0 ? `-1/-1 ${card.minusOneCounters}` : null,
                      (card.loyalty ?? 0) > 0 ? `Loyalty ${card.loyalty}` : null,
                    ].filter(Boolean).join(' • ')}
                  </div>
                </button>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-700 px-3 py-4 text-sm text-slate-500">
                  No permanents have counters
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between border-t border-slate-700 px-5 py-4">
          <div className="text-xs text-slate-500">
            {selectedPlayerIds.length + selectedCardIds.length} target{selectedPlayerIds.length + selectedCardIds.length === 1 ? '' : 's'} selected
          </div>
          <button
            type="button"
            disabled={!canAct}
            onClick={() => onConfirm(selectedPlayerIds, selectedCardIds)}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
