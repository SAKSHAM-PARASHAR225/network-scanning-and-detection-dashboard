import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps, type TooltipValueType } from 'recharts'
import type { NameType as TooltipNameType } from 'recharts/types/component/DefaultTooltipContent'
import { Eye, EyeOff } from 'lucide-react'
import { EmptyState } from '../common/EmptyState'
import { useWirelessMonitoring } from '../../hooks/useWirelessMonitoring'
import { latestLiveReading, useLiveSignal } from '../../hooks/useLiveSignal'
import { useNow } from '../../hooks/useNow'
import { buildSeries, matchesSignalFilter, SIGNAL_FILTERS, type SignalFilter } from '../../utils/signalSeries'

interface LiveSignalChartProps {
  heightClass?: string
}

const TOOLTIP_MAX_ROWS = 8

function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function LiveSignalChart({ heightClass = 'h-80' }: LiveSignalChartProps) {
  const { networks } = useWirelessMonitoring()
  const { points, lastTickAt } = useLiveSignal()
  const now = useNow(1000)
  const [filter, setFilter] = useState<SignalFilter>('ALL')
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  const visibleNetworks = useMemo(() => networks.filter((network) => network.isCurrentlyVisible), [networks])

  const counts = useMemo(() => {
    const tally = {} as Record<SignalFilter, number>
    SIGNAL_FILTERS.forEach((option) => { tally[option] = visibleNetworks.filter((network) => matchesSignalFilter(network, option)).length })
    return tally
  }, [visibleNetworks])

  // Only networks that have actually shown up in the live feed get a line,
  // strongest first so the legend reads in signal order.
  const tracked = useMemo(() => {
    return visibleNetworks
      .filter((network) => matchesSignalFilter(network, filter))
      .map((network) => ({ network, latest: latestLiveReading(points, network.bssid) }))
      .filter((entry) => entry.latest !== null)
      .sort((a, b) => (b.latest?.signal ?? -100) - (a.latest?.signal ?? -100))
      .map((entry) => entry.network)
  }, [visibleNetworks, filter, points])

  const series = useMemo(() => buildSeries(tracked), [tracked])
  const labelByKey = useMemo(() => new Map(series.map((entry) => [entry.key, entry])), [series])

  const rows = useMemo(() => points.map((point) => {
    const row: Record<string, number | string> = { time: timeLabel(point.timestampMs) }
    series.forEach(({ key }) => {
      const value = point.values[key]
      if (value !== undefined) row[key] = value
    })
    return row
  }), [points, series])

  const secondsSinceTick = lastTickAt !== null ? Math.max(0, Math.round((now - lastTickAt) / 1000)) : null
  const isLive = secondsSinceTick !== null && secondsSinceTick <= 5

  const setAllHidden = (value: boolean) => setHidden(Object.fromEntries(series.map((entry) => [entry.key, value])))

  const renderTooltip = ({ active, payload, label }: TooltipContentProps<TooltipValueType, TooltipNameType>) => {
    if (!active || !payload?.length) return null
    const sorted = [...payload].sort((a, b) => Number(b.value) - Number(a.value))
    return (
      <div className="rounded-xl border border-cyan-400/30 bg-[#060c16]/95 px-3 py-2 text-xs backdrop-blur">
        <p className="mb-1.5 font-mono text-slate-400">{label}</p>
        {sorted.slice(0, TOOLTIP_MAX_ROWS).map((item) => (
          <div key={String(item.dataKey)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
              {labelByKey.get(String(item.dataKey))?.label ?? item.name}
            </span>
            <span className="font-mono text-slate-300">{item.value} dBm</span>
          </div>
        ))}
        {sorted.length > TOOLTIP_MAX_ROWS && <p className="mt-1 text-slate-500">+{sorted.length - TOOLTIP_MAX_ROWS} more</p>}
      </div>
    )
  }

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-100">Signal Strength Trends</h3>
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${isLive ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-slate-600 bg-slate-800/60 text-slate-400'}`}>
            <span className="relative flex h-1.5 w-1.5">
              {isLive && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />}
              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${isLive ? 'bg-emerald-400' : 'bg-slate-500'}`} />
            </span>
            {isLive ? 'Live' : 'Waiting'}
          </span>
          <span className="text-[11px] text-slate-500">
            {secondsSinceTick === null ? 'Waiting for live feed' : `Updated ${secondsSinceTick}s ago`}
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
          <span className="font-mono text-base text-cyan-200">{series.length}</span> Networks
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter networks by status" className="inline-flex rounded-xl border border-sg-border bg-[#050b14]/70 p-1">
          {SIGNAL_FILTERS.map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={filter === option}
              onClick={() => setFilter(option)}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-all ${filter === option ? 'bg-cyan-400/15 text-cyan-200' : 'text-slate-400 hover:text-slate-200'}`}
            >
              {option} <span className="ml-1 font-mono text-[10px] opacity-70">{counts[option]}</span>
            </button>
          ))}
        </div>
        {series.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setAllHidden(false)} className="inline-flex items-center gap-1.5 rounded-lg border border-sg-border bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"><Eye className="h-3 w-3" />Show all</button>
            <button onClick={() => setAllHidden(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-sg-border bg-white/5 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-200"><EyeOff className="h-3 w-3" />Hide all</button>
          </div>
        )}
      </div>

      {points.length < 2 ? (
        <EmptyState title="Collecting live readings..." description="The signal feed updates every second. The graph starts drawing after the first two readings arrive." />
      ) : series.length === 0 ? (
        <EmptyState title={`No ${filter.toLowerCase()} networks in range`} description="Nothing with this classification is currently visible. Switch to ALL to see every network." />
      ) : (
        <>
          <div key={filter} className={`${heightClass} animate-sg-fade`}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(94, 165, 245, 0.12)" />
                <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 11 }} stroke="#334155" minTickGap={48} />
                <YAxis
                  domain={[(min: number) => Math.max(-100, Math.floor(min / 5) * 5 - 5), (max: number) => Math.min(-20, Math.ceil(max / 5) * 5 + 5)]}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  stroke="#334155"
                  width={64}
                  tickFormatter={(value) => `${value} dBm`}
                />
                <Tooltip content={renderTooltip} />
                {series.map(({ key, label, color }) => (
                  hidden[key] ? null : (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={label}
                      stroke={color}
                      strokeWidth={1.75}
                      dot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  )
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto border-t border-white/5 pt-3 text-xs">
            {series.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setHidden((prev) => ({ ...prev, [key]: !prev[key] }))}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition ${hidden[key] ? 'border-slate-700 bg-slate-950 text-slate-500 line-through' : 'border-slate-600/70 bg-slate-800/60 text-slate-100'}`}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: hidden[key] ? '#475569' : color }} />
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
