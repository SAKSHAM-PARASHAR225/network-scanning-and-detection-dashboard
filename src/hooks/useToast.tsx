import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Toast, type ToastTone } from '../components/common/Toast'

interface ToastEntry {
  id: number
  message: string
  detail?: string
  tone: ToastTone
}

interface ToastContextValue {
  showToast: (message: string, detail?: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((message: string, detail?: string, tone: ToastTone = 'success') => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, message, detail, tone }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} detail={toast.detail} tone={toast.tone} onClose={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within a ToastProvider')
  return context
}
