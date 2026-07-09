'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
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

export function DonutCategorias({ datos }: { datos: Dato[] }) {
  if (datos.length === 0) {
    return <p className="text-center text-sm text-gray-400 py-10">Sin egresos este mes</p>
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={datos}
          dataKey="valor"
          nameKey="nombre"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {datos.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
          iconType="circle"
          iconSize={8}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
