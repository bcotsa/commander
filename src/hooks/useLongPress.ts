import { useRef, useCallback } from 'react'

interface LongPressOptions {
  onPress: () => void
  onLongPress: () => void
  delay?: number
}

export function useLongPress({ onPress, onLongPress, delay = 500 }: LongPressOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggered = useRef(false)

  const start = useCallback(() => {
    longPressTriggered.current = false
    timerRef.current = setTimeout(() => {
      longPressTriggered.current = true
      onLongPress()
      if ('vibrate' in navigator) navigator.vibrate(50)
    }, delay)
  }, [onLongPress, delay])

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!longPressTriggered.current) {
      onPress()
    }
  }, [onPress])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    longPressTriggered.current = false
  }, [])

  return {
    onPointerDown: start,
    onPointerUp: clear,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
  }
}
