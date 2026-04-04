import { LifeCounter } from './LifeCounter'
import { ColorPips } from '@/components/ui/ColorPips'
import type { Player } from '@/types/game-state'

interface PlayerTileProps {
  player: Player
  isCurrentTurn: boolean
  rotated?: boolean
  onLifeDelta: (delta: number) => void
  onOpenDamage: () => void
  onOpenCounters: () => void
}

export function PlayerTile({
  player, isCurrentTurn, rotated, onLifeDelta, onOpenDamage, onOpenCounters
}: PlayerTileProps) {
  const borderColor = isCurrentTurn ? 'border-violet-500' : 'border-slate-700'
  const { library, hand, battlefield, graveyard, exile, commandZone } = player.zones
  const visibleHand = hand.slice(0, 7)

  return (
    <div
      className={`relative flex flex-col border-2 ${borderColor} rounded-2xl overflow-hidden bg-slate-900 transition-colors`}
      style={{
        backgroundImage: player.commander?.imageUri
          ? `linear-gradient(to bottom, rgba(15,23,42,0.5) 0%, rgba(15,23,42,0.92) 50%, rgba(15,23,42,1) 100%), url(${player.commander.imageUri})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
    >
      {/* Eliminated overlay */}
      {player.isEliminated && (
        <div className="absolute inset-0 bg-black/70 z-10 flex flex-col items-center justify-center gap-2">
          <span className="text-5xl">💀</span>
          <span className="text-slate-400 text-sm font-medium">Eliminated</span>
        </div>
      )}

      {/* Header */}
      <div className={`px-3 pt-2 pb-1 flex items-center gap-2 ${rotated ? 'flex-row-reverse' : ''}`}>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-semibold text-sm truncate">{player.name || `Player ${player.seat + 1}`}</span>
          {player.commander && (
            <span className="text-xs text-slate-400 truncate">{player.commander.name}</span>
          )}
        </div>
        {player.commander && <ColorPips colors={player.commander.colorIdentity} />}
        {isCurrentTurn && (
          <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">Turn</span>
        )}
      </div>

      {/* Life counter — takes up most of the space */}
      <div className="flex-1 min-h-0">
        <LifeCounter
          life={player.life}
          eliminated={player.isEliminated}
          onDelta={onLifeDelta}
          rotated={rotated}
        />
      </div>

      {/* Zones */}
      <div className="px-2 py-2 border-t border-slate-700/50 bg-slate-950/70">
        <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300">
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Library</div>
            <div className="mt-1 text-sm font-semibold">{library.length}</div>
          </div>
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Command</div>
            <div className="mt-1 text-sm font-semibold">{commandZone.length}</div>
            {commandZone[0] && <div className="mt-1 truncate">{commandZone[0].name}</div>}
          </div>
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Battlefield</div>
            <div className="mt-1 text-sm font-semibold">{battlefield.length}</div>
          </div>
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Graveyard</div>
            <div className="mt-1 text-sm font-semibold">{graveyard.length}</div>
          </div>
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Exile</div>
            <div className="mt-1 text-sm font-semibold">{exile.length}</div>
          </div>
          <div className="rounded-lg bg-slate-800/90 p-2">
            <div className="text-slate-500 uppercase tracking-wide">Hand</div>
            <div className="mt-1 text-sm font-semibold">{hand.length}</div>
          </div>
        </div>

        <div className="mt-2">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-slate-500">Opening Hand</div>
          <div className="grid grid-cols-2 gap-1.5">
            {visibleHand.map(card => (
              <div key={card.instanceId} className="rounded-lg bg-slate-800/90 px-2 py-1.5 text-xs text-slate-200">
                <div className="truncate font-medium">{card.name}</div>
                <div className="truncate text-[10px] text-slate-500">{card.typeLine || 'Card'}</div>
              </div>
            ))}
            {visibleHand.length === 0 && (
              <div className="col-span-2 rounded-lg border border-dashed border-slate-700 px-2 py-3 text-xs text-slate-500">
                No cards drawn
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-1 px-2 py-1">
        {player.hasMonarch && (
          <span className="text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-600 px-1.5 py-0.5 rounded-full">👑 Monarch</span>
        )}
        {player.hasInitiative && (
          <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-600 px-1.5 py-0.5 rounded-full">⚔️ Initiative</span>
        )}
        {player.counters.poison > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${player.counters.poison >= 10 ? 'bg-green-500 text-white' : 'bg-green-900/40 text-green-400 border border-green-700'}`}>
            ☠️ {player.counters.poison}
          </span>
        )}
        {!player.isConnected && (
          <span className="text-xs bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">⚡ offline</span>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex border-t border-slate-700/50">
        <button
          onClick={onOpenDamage}
          className="flex-1 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-center"
        >
          ⚔️ Cmdr Dmg
        </button>
        <button
          onClick={onOpenCounters}
          className="flex-1 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors text-center border-l border-slate-700/50"
        >
          🔢 Counters
        </button>
      </div>
    </div>
  )
}
