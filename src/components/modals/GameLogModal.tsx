import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { LogEntry } from '@/types/game-state'

interface GameLogModalProps {
  open: boolean
  onClose: () => void
  log: LogEntry[]
  onUndo: () => void
  canUndo: boolean
}

export function GameLogModal({ open, onClose, log, onUndo, canUndo }: GameLogModalProps) {
  const reversed = [...log].reverse()

  return (
    <Modal open={open} onClose={onClose} title="Game Log">
      <div className="p-5 flex flex-col gap-4">
        {canUndo && (
          <Button variant="secondary" onClick={onUndo} className="w-full">
            ↩ Undo Last Action
          </Button>
        )}

        {reversed.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No actions yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {reversed.map((entry) => (
              <div key={entry.seq} className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0">
                <span className="text-xs text-slate-600 flex-shrink-0 mt-0.5 tabular-nums w-8 text-right">
                  #{entry.seq}
                </span>
                <span className="text-sm text-slate-300 flex-1">{entry.description}</span>
                <span className="text-xs text-slate-600 flex-shrink-0">
                  {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
