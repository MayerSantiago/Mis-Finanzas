'use client'

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatCOP } from '@/lib/format'

interface Dato { nombre: string; valor: number; color: string }

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: Dato }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{d.nombre}</p>
      <p className="text-gray-600">{formatCOP(d.valor)}</p>
    </div>
  )
}

export function BarrasHorizontales({ datos }: { datos: Dato[] }) {
  if (datos.length === 0) return <p className="text-center text-sm text-gray-400 py-8">Sin datos</p>

  return (
    <ResponsiveContainer width="100%" height={Math.max(datos.length * 38, 120)}>
      <BarChart data={datos} layout="vertical" barSize={14} margin={{ left: 0, right: 16 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="nombre"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          width={110}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
        <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
          {datos.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
