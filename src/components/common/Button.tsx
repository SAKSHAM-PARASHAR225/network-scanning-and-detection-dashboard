import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: ReactNode
}

export function Button({ variant = 'primary', icon, children, className = '', ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(56,189,248,0.25)]',
    secondary: 'bg-[#0d1722] text-slate-100 border border-white/8 hover:bg-[#121d2b]',
    ghost: 'bg-transparent text-slate-200 border border-white/8 hover:bg-white/5',
    danger: 'bg-red-500/10 text-red-200 border border-red-500/40 hover:bg-red-500/20',
  }

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${variants[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
