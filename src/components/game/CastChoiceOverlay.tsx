import { useMemo, useState } from 'react'
import { canAutoPayManaCost, getCastChoiceSpec, resolveManaCost } from '@/lib/card-rules'
import type { CastOptions, GameCard, Player } from '@/types/game-state'

interface CastChoiceOverlayProps {
  player: Player
  allPlayers: Player[]
  card: GameCard
  source: 'hand' | 'commandZone'
  onCancel: () => void
  onConfirm: (payload: { options?: CastOptions; targetCardId?: string; targetPlayerId?: string }) => void
}

export function CastChoiceOverlay({
  player,
  allPlayers,
  card,
  source,
  onCancel,
  onConfirm,
}: CastChoiceOverlayProps) {
  const spec = getCastChoiceSpec(card, player)
  const [xValue, setXValue] = useState(card.manaCost?.includes('{X}') ? 1 : 0)
  const [mode, setMode] = useState(spec?.kind === 'modal' ? spec.modes[0]?.id ?? '' : '')
  const [targetCardId, setTargetCardId] = useState<string>('')
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])
  const [sacrificedCardId, setSacrificedCardId] = useState<string>('')

  const handOptions = source === 'hand'
    ? player.zones.hand.filter(entry => entry.instanceId !== card.instanceId)
    : player.zones.hand
  const sacrificeCandidates = [...player.zones.battlefield, ...player.zones.lands].filter(entry => {
    const typeLine = entry.typeLine.toLowerCase()
    return typeLine.includes('artifact') || typeLine.includes('creature')
  })
  const damageTargets = allPlayers.flatMap(otherPlayer =>
    otherPlayer.zones.battlefield
      .filter(entry => {
        const typeLine = entry.typeLine.toLowerCase()
        return typeLine.includes('creature') || typeLine.includes('planeswalker')
      })
      .map(entry => ({ owner: otherPlayer, card: entry }))
  )

  const resolvedManaCost = resolveManaCost(card.manaCost, xValue)
  const canPay = useMemo(
    () => canAutoPayManaCost(player.manaPool, [...player.zones.lands, ...player.zones.battlefield], resolvedManaCost, player),
    [player, resolvedManaCost]
  )

  const canConfirm = useMemo(() => {
    if (!canPay) return false
    if (!spec) return true
    if (spec.kind === 'sacrifice_cost') return Boolean(sacrificedCardId)
    if (spec.kind === 'modal' && mode === 'damage') return Boolean(targetCardId)
    return true
  }, [canPay, mode, sacrificedCardId, spec, targetCardId])

  if (!spec && !card.manaCost?.includes('{X}')) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4">
          <div className="text-lg font-semibold text-white">{card.name}</div>
          <div className="text-sm text-slate-400">
            Choose spell options before casting
          </div>
        </div>

        {(spec?.kind === 'x_value' || card.manaCost?.includes('{X}')) && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-200">X Value</div>
            <input
              type="number"
              min={spec?.kind === 'x_value' ? spec.min : 0}
              max={spec?.kind === 'x_value' ? spec.max : undefined}
              value={xValue}
              onChange={(event) => setXValue(Math.max(0, Number(event.target.value) || 0))}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
            <div className="mt-1 text-xs text-slate-500">Mana cost: {resolvedManaCost ?? 'Free'}</div>
          </div>
        )}

        {spec?.kind === 'modal' && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-200">Mode</div>
            <div className="flex flex-col gap-2">
              {spec.modes.map(entry => (
                <label key={entry.id} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">
                  <input
                    type="radio"
                    checked={mode === entry.id}
                    onChange={() => {
                      setMode(entry.id)
                      setTargetCardId('')
                      setSelectedCardIds([])
                    }}
                  />
                  <span>{entry.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {spec?.kind === 'sacrifice_cost' && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-200">Sacrifice as Additional Cost</div>
            <div className="grid max-h-48 gap-2 overflow-y-auto">
              {sacrificeCandidates.map(entry => (
                <button
                  key={entry.instanceId}
                  type="button"
                  onClick={() => setSacrificedCardId(entry.instanceId)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    sacrificedCardId === entry.instanceId
                      ? 'border-violet-500 bg-violet-950/40 text-white'
                      : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {spec?.kind === 'modal' && mode === 'damage' && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-200">Target</div>
            <div className="grid max-h-48 gap-2 overflow-y-auto">
              {damageTargets.map(({ owner, card: target }) => (
                <button
                  key={target.instanceId}
                  type="button"
                  onClick={() => setTargetCardId(target.instanceId)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    targetCardId === target.instanceId
                      ? 'border-violet-500 bg-violet-950/40 text-white'
                      : 'border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {owner.name}: {target.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {spec?.kind === 'modal' && mode === 'loot' && (
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-200">Discard Up To Two Cards</div>
            <div className="grid max-h-48 gap-2 overflow-y-auto">
              {handOptions.map(entry => {
                const checked = selectedCardIds.includes(entry.instanceId)
                return (
                  <label key={entry.instanceId} className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedCardIds(current =>
                          checked
                            ? current.filter(id => id !== entry.instanceId)
                            : current.length >= 2
                            ? current
                            : [...current, entry.instanceId]
                        )
                      }}
                    />
                    <span>{entry.name}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {canPay ? 'Auto-pay available' : 'Not enough mana for this choice'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm({
                targetCardId: targetCardId || undefined,
                options: {
                  xValue: card.manaCost?.includes('{X}') ? xValue : undefined,
                  mode: mode || undefined,
                  selectedCardIds: selectedCardIds.length > 0 ? selectedCardIds : undefined,
                  sacrificedCardId: sacrificedCardId || undefined,
                },
              })}
              disabled={!canConfirm}
              className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white transition-colors enabled:hover:bg-violet-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cast
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
