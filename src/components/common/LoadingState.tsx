export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="space-y-3 glass-card rounded-2xl p-4">
      <div className="h-4 w-24 animate-pulse rounded bg-slate-700" />
      <div className="h-10 animate-pulse rounded bg-slate-800" />
      <div className="h-10 animate-pulse rounded bg-slate-800" />
      <div className="h-10 animate-pulse rounded bg-slate-800" />
      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
    </div>
  )
}
