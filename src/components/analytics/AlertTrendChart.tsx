import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export function AlertTrendChart({ data }: { data: Array<{ time: string; alerts: number }> }) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <h3 className="mb-4 text-lg font-semibold text-slate-100">Security alerts over time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} stroke="#475569" />
            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }} />
            <Line type="monotone" dataKey="alerts" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
