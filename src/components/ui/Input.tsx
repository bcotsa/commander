import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export function Input({ label, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <input
        {...props}
        className={`
          bg-slate-800 border border-slate-600 rounded-xl px-4 py-3
          text-white placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
          ${className}
        `}
      />
    </div>
  )
}
