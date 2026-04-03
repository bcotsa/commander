import { useUiStore } from '@/store/ui-store'

export function Toast() {
  const toast = useUiStore(s => s.toast)
  if (!toast) return null
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 border border-slate-600 text-white px-5 py-3 rounded-xl shadow-2xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-200">
      {toast}
    </div>
  )
}
