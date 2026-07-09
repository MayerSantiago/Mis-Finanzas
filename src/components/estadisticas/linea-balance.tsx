'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCOP } from '@/lib/format'

interface Mes { mes: string; balance: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-semibold text-gray-700">{label}</p>
      <p className={val >= 0 ? 'text-emerald-600' : 'text-red-500'}>{formatCOP(val)}</p>
    </div>
  )
}

export function LineaBalance({ datos }: { datos: Mes[] }) {
  if (datos.every(d => d.balance === 0)) return <p className="text-center text-sm text-gray-400 py-8">Sin datos</p>

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={datos}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45} />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={0} stroke="#e5e7eb" strokeDasharray="4 2" />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
