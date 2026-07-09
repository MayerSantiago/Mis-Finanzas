'use client'

import { useState } from 'react'
import { formatCOP } from '@/lib/format'
import type { PeriodoAmortizacion } from '@/lib/amortizacion'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  periodos: PeriodoAmortizacion[]
  cuotasPagadas?: number
}

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtFecha(iso: string) {
  const [y, m] = iso.split('-')
  return `${MESES_ES[parseInt(m) - 1]} ${y}`
}

export function TablaAmortizacion({ periodos, cuotasPagadas = 0 }: Props) {
  const [expandido, setExpandido] = useState(false)

  if (!periodos.length) {
    return (
      <p className="text-xs text-gray-400 text-center py-4">
        Ingresa saldo, tasa y plazo para ver la proyección
      </p>
    )
  }

  const visible = expandido ? periodos : periodos.slice(0, 6)
  const totalIntereses = periodos.reduce((s, p) => s + p.interes, 0)
  const totalCapital   = periodos.reduce((s, p) => s + p.capital, 0)

  return (
    <div className="space-y-3">
      {/* Resumen tabla */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-xl p-2">
          <p className="text-[10px] text-gray-400">Cuotas</p>
          <p className="font-bold text-gray-800 text-sm">{periodos.length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-2">
          <p className="text-[10px] text-blue-400">Total interés</p>
          <p className="font-bold text-blue-700 text-sm">{formatCOP(totalIntereses)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-2">
          <p className="text-[10px] text-emerald-400">Total capital</p>
          <p className="font-bold text-emerald-700 text-sm">{formatCOP(totalCapital)}</p>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-100">
              <th className="text-left py-2 px-1">#</th>
              <th className="text-left py-2 px-1">Fecha</th>
              <th className="text-right py-2 px-1">Cuota</th>
              <th className="text-right py-2 px-1">Interés</th>
              <th className="text-right py-2 px-1">Capital</th>
              <th className="text-right py-2 px-1">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((p, i) => {
              const pagado = i < cuotasPagadas
              return (
                <tr
                  key={p.periodo}
                  className={`border-b border-gray-50 ${pagado ? 'opacity-40' : ''}`}
                >
                  <td className={`py-2 px-1 font-medium ${pagado ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                    {p.periodo}
                  </td>
                  <td className="py-2 px-1 text-gray-500">{fmtFecha(p.fecha)}</td>
                  <td className="py-2 px-1 text-right font-medium text-gray-700">{formatCOP(p.cuota)}</td>
                  <td className="py-2 px-1 text-right text-red-500">{formatCOP(p.interes)}</td>
                  <td className="py-2 px-1 text-right text-emerald-600">{formatCOP(p.capital)}</td>
                  <td className="py-2 px-1 text-right text-gray-500">{formatCOP(p.saldo)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {periodos.length > 6 && (
        <button
          onClick={() => setExpandido(!expandido)}
          className="w-full flex items-center justify-center gap-1 text-xs text-emerald-600 py-2 hover:text-emerald-700"
        >
          {expandido ? (
            <><ChevronUp className="h-3 w-3" /> Ver menos</>
          ) : (
            <><ChevronDown className="h-3 w-3" /> Ver todas las {periodos.length} cuotas</>
          )}
        </button>
      )}
    </div>
  )
}
