import { AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react'

export type ToastTone = 'success' | 'warning' | 'danger'

interface ToastProps {
  message: string
  detail?: string
  tone?: ToastTone
  onClose: () => void
}

const TONE_STYLES: Record<ToastTone, { border: string; icon: typeof CheckCircle2; iconClass: string }> = {
  success: { border: 'border-emerald-500/30', icon: CheckCircle2, iconClass: 'text-emerald-400' },
  warning: { border: 'border-amber-500/30', icon: AlertTriangle, iconClass: 'text-amber-400' },
  danger: { border: 'border-red-500/40', icon: ShieldAlert, iconClass: 'text-red-400' },
}

export function Toast({ message, detail, tone = 'success', onClose }: ToastProps) {
  const { border, icon: Icon, iconClass } = TONE_STYLES[tone]

  return (
    <div className={`flex min-w-[280px] max-w-md items-start gap-3 rounded-xl border ${border} bg-slate-900 p-3 shadow-soft`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-100">{message}</p>
        {detail ? <p className="mt-1 text-xs text-slate-400">{detail}</p> : null}
      </div>
      <button aria-label="Dismiss notification" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
