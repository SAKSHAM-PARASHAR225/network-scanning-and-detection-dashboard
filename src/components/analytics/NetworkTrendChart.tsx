import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function NetworkTrendChart({ data }: { data: Array<{ time: string; networks: number }> }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Networks detected over time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="networkFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.7} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
            <Area type="monotone" dataKey="networks" stroke="#38bdf8" fill="url(#networkFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
