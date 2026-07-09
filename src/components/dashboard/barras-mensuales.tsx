'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { formatCOP } from '@/lib/format'

interface Mes { mes: string; ingresos: number; egresos: number }

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm space-y-1">
      <p className="font-semibold text-gray-700 capitalize">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.name === 'Ingresos' ? '#10b981' : '#ef4444' }}>
          {p.name}: {formatCOP(p.value)}
        </p>
      ))}
    </div>
  )
}

export function BarrasMensuales({ datos }: { datos: Mes[] }) {
  if (datos.every(d => d.ingresos === 0 && d.egresos === 0)) {
    return <p className="text-center text-sm text-gray-400 py-10">Sin datos para mostrar</p>
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} barGap={4} barSize={14}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={45} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={v => <span className="text-xs text-gray-600">{v}</span>} iconType="circle" iconSize={8} />
        <Bar dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
        <Bar dataKey="egresos"  name="Egresos"  fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
