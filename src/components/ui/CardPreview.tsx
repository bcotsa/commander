import { useState, useRef, useCallback } from 'react'

interface CardPreviewProps {
  imageUri: string
  name: string
  children: React.ReactNode
}

/**
 * Wraps any card thumbnail. On hover (desktop) shows a large preview
 * anchored to the cursor position, staying within the viewport.
 */
export function CardPreview({ imageUri, name, children }: CardPreviewProps) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const wrapperRef = useRef<HTMLDivElement>(null)

  const PREVIEW_W = 250
  const PREVIEW_H = 350

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pad = 16
    let x = e.clientX + pad
    let y = e.clientY - PREVIEW_H / 2

    // Keep within viewport
    if (x + PREVIEW_W > window.innerWidth) {
      x = e.clientX - PREVIEW_W - pad
    }
    if (y < pad) {
      y = pad
    }
    if (y + PREVIEW_H > window.innerHeight - pad) {
      y = window.innerHeight - PREVIEW_H - pad
    }

    setPos({ x, y })
  }, [])

  return (
    <div
      ref={wrapperRef}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onMouseMove={handleMouseMove}
      className="relative"
    >
      {children}

      {show && imageUri && (
        <div
          className="fixed z-[200] pointer-events-none"
          style={{ left: pos.x, top: pos.y }}
        >
          <img
            src={imageUri}
            alt={name}
            className="rounded-xl shadow-2xl shadow-black/80 border border-slate-600"
            style={{ width: PREVIEW_W, height: PREVIEW_H, objectFit: 'cover' }}
          />
          <div className="mt-1 text-xs text-slate-300 font-medium text-center truncate px-1" style={{ maxWidth: PREVIEW_W }}>
            {name}
          </div>
        </div>
      )}
    </div>
  )
}
