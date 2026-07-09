'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatCOP } from '@/lib/format'
import type { Deuda } from '@/types'
import { DeudaForm } from './deuda-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, ChevronRight, TrendingDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  deudas: Deuda[]
}

export function DeudasClient({ deudas: inicial }: Props) {
  const [deudas, setDeudas] = useState<Deuda[]>(inicial)
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Deuda | null>(null)
  const router = useRouter()

  const activas = deudas.filter(d => d.estado === 'activa')
  const pagadas = deudas.filter(d => d.estado === 'pagada')
  const totalDeuda = activas.reduce((s, d) => s + d.saldo_actual, 0)
  const totalOriginal = activas.reduce((s, d) => s + d.monto_original, 0)
  const totalCuotas = activas.reduce((s, d) => s + (d.cuota_estimada ?? 0), 0)

  function handleSaved(deuda: Deuda) {
    setDeudas(prev => {
      const idx = prev.findIndex(d => d.id === deuda.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = deuda
        return next
      }
      return [deuda, ...prev]
    })
  }

  async function marcarPagada(deuda: Deuda) {
    const supabase = createClient()
    const { data: updated } = await supabase
      .from('debts')
      .update({ estado: 'pagada', saldo_actual: 0 })
      .eq('id', deuda.id)
      .select()
      .single()
    if (updated) handleSaved(updated as Deuda)
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Deudas</h1>
          <p className="text-sm text-gray-500">{activas.length} activa{activas.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          onClick={() => { setEditando(null); setFormOpen(true) }}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      {/* Resumen total */}
      {activas.length > 0 && (
        <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">Deuda total activa</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCOP(totalDeuda)}</p>
          <div className="flex justify-between text-xs text-red-400 mt-1">
            <span>Original: {formatCOP(totalOriginal)}</span>
            <span>Cuotas/mes: {formatCOP(totalCuotas)}</span>
          </div>
          {totalOriginal > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-red-500 mb-1">
                <span>Progreso pagado</span>
                <span>{(((totalOriginal - totalDeuda) / totalOriginal) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-red-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${Math.min(((totalOriginal - totalDeuda) / totalOriginal) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deudas activas */}
      {activas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <TrendingDown className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Sin deudas activas</p>
          <p className="text-sm mt-1">Registra tus créditos y obligaciones financieras</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activas.map(deuda => {
            const pct = deuda.monto_original > 0
              ? ((deuda.monto_original - deuda.saldo_actual) / deuda.monto_original) * 100
              : 0
            return (
              <div
                key={deuda.id}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-gray-200 transition-colors"
                onClick={() => router.push(`/deudas/${deuda.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-800">{deuda.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {deuda.tasa_interes}% {deuda.tasa_tipo}
                      {deuda.plazo_meses ? ` · ${deuda.plazo_meses} meses` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-red-50 text-red-600 border-red-100 text-[10px]">
                      Activa
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-[10px] text-gray-400">Saldo actual</p>
                    <p className="font-bold text-red-600 text-sm">{formatCOP(deuda.saldo_actual)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400">Cuota estimada/mes</p>
                    <p className="font-bold text-gray-700 text-sm">
                      {deuda.cuota_estimada ? formatCOP(deuda.cuota_estimada) : '—'}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Pagado: {formatCOP(deuda.monto_original - deuda.saldo_actual)}</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Deudas pagadas */}
      {pagadas.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Pagadas</p>
          <div className="space-y-2">
            {pagadas.map(deuda => (
              <div
                key={deuda.id}
                className="bg-white rounded-xl p-3 border border-gray-100 flex items-center justify-between cursor-pointer opacity-60"
                onClick={() => router.push(`/deudas/${deuda.id}`)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-700">{deuda.nombre}</p>
                  <p className="text-xs text-gray-400">{formatCOP(deuda.monto_original)}</p>
                </div>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[10px]">
                  Pagada
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeudaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        editando={editando}
      />
    </div>
  )
}
