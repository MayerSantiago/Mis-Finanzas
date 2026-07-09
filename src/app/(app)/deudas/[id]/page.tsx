'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { tasaMensualEfectiva, calcularAmortizacion } from '@/lib/amortizacion'
import type { Deuda, AbonoDeuda, TipoTasa } from '@/types'
import { TablaAmortizacion } from '@/components/deudas/tabla-amortizacion'
import { AbonoForm } from '@/components/deudas/abono-form'
import { DeudaForm } from '@/components/deudas/deuda-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Plus, Pencil, Trash2, CheckCircle } from 'lucide-react'

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

function fmtFecha(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d} ${MESES_ES[parseInt(m) - 1]} ${y}`
}

export default function DeudaDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [deuda, setDeuda] = useState<Deuda | null>(null)
  const [abonos, setAbonos] = useState<AbonoDeuda[]>([])
  const [loading, setLoading] = useState(true)
  const [abonoOpen, setAbonoOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  async function cargar() {
    const supabase = createClient()
    const [{ data: d }, { data: a }] = await Promise.all([
      supabase.from('debts').select('*').eq('id', id).single(),
      supabase.from('debt_payments').select('*').eq('debt_id', id).order('fecha', { ascending: false }),
    ])
    if (d) setDeuda(d as Deuda)
    setAbonos((a ?? []) as AbonoDeuda[])
    setLoading(false)
  }

  useEffect(() => { cargar() }, [id])

  async function eliminar() {
    const supabase = createClient()
    await supabase.from('debts').delete().eq('id', id)
    router.push('/deudas')
  }

  async function marcarPagada() {
    const supabase = createClient()
    const { data: updated } = await supabase
      .from('debts')
      .update({ estado: 'pagada', saldo_actual: 0 })
      .eq('id', id)
      .select()
      .single()
    if (updated) setDeuda(updated as Deuda)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-100 rounded w-1/3" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!deuda) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-400">Deuda no encontrada</p>
        <Button variant="outline" onClick={() => router.push('/deudas')} className="mt-4">Volver</Button>
      </div>
    )
  }

  const im = tasaMensualEfectiva(deuda.tasa_interes, deuda.tasa_tipo as TipoTasa)
  const periodos = calcularAmortizacion({
    saldo: deuda.saldo_actual,
    tasaMes: im,
    plazoMeses: deuda.plazo_meses,
    cuotaEstimada: deuda.cuota_estimada,
    fechaInicio: new Date().toISOString().split('T')[0],
  })

  const pct = deuda.monto_original > 0
    ? ((deuda.monto_original - deuda.saldo_actual) / deuda.monto_original) * 100
    : 0

  const totalAbonado = abonos.reduce((s, a) => s + a.monto, 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/deudas')} className="mt-1 text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 truncate">{deuda.nombre}</h1>
            <Badge
              variant="secondary"
              className={deuda.estado === 'activa'
                ? 'bg-red-50 text-red-600 border-red-100'
                : 'bg-emerald-50 text-emerald-600 border-emerald-100'}
            >
              {deuda.estado === 'activa' ? 'Activa' : 'Pagada'}
            </Badge>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {deuda.tasa_interes}% {deuda.tasa_tipo} · desde {fmtFecha(deuda.fecha_inicio)}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4 text-gray-400" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-gray-100 transition-colors">
              <Trash2 className="h-4 w-4 text-red-400" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar deuda?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán también todos los abonos registrados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={eliminar} className="bg-red-600 hover:bg-red-700">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tarjeta principal */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-400">Monto original</p>
            <p className="font-bold text-gray-700">{formatCOP(deuda.monto_original)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Saldo actual</p>
            <p className={`font-bold text-lg ${deuda.saldo_actual > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {formatCOP(deuda.saldo_actual)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Cuota estimada/mes</p>
            <p className="font-bold text-gray-700">
              {deuda.cuota_estimada ? formatCOP(deuda.cuota_estimada) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Total abonado</p>
            <p className="font-bold text-emerald-600">{formatCOP(totalAbonado)}</p>
          </div>
        </div>

        {/* Progreso */}
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Pagado</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          {periodos.length > 0 && (
            <p className="text-xs text-gray-400 mt-1.5 text-right">
              Proyección de pago: {fmtFecha(periodos[periodos.length - 1].fecha)}
            </p>
          )}
        </div>

        {/* Acción marcar pagada */}
        {deuda.estado === 'activa' && (
          <AlertDialog>
            <AlertDialogTrigger className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-50 text-sm font-medium h-9 px-3 transition-colors">
              <CheckCircle className="h-4 w-4" /> Marcar como pagada
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Marcar como pagada?</AlertDialogTitle>
                <AlertDialogDescription>
                  El saldo se establecerá en $0 y la deuda quedará como pagada.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={marcarPagada} className="bg-emerald-600 hover:bg-emerald-700">
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Tabla de amortización */}
      {deuda.estado === 'activa' && periodos.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Tabla de amortización</h2>
          <TablaAmortizacion periodos={periodos} />
        </div>
      )}

      {/* Historial de abonos */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800 text-sm">
            Historial de abonos
            {abonos.length > 0 && <span className="text-gray-400 font-normal ml-1">({abonos.length})</span>}
          </h2>
          {deuda.estado === 'activa' && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 h-7 text-xs"
              onClick={() => setAbonoOpen(true)}
            >
              <Plus className="h-3 w-3" /> Registrar
            </Button>
          )}
        </div>

        {abonos.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Sin abonos registrados</p>
        ) : (
          <div className="space-y-2">
            {abonos.map(a => (
              <div key={a.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{formatCOP(a.monto)}</p>
                  <p className="text-xs text-gray-400">
                    {fmtFecha(a.fecha)}
                    <span className="ml-2 capitalize">{a.tipo}</span>
                    {a.nota && <span className="ml-2 text-gray-300">· {a.nota}</span>}
                  </p>
                </div>
                <span className="text-xs font-medium text-emerald-600">+{formatCOP(a.monto)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AbonoForm
        open={abonoOpen}
        debtId={id}
        onClose={() => setAbonoOpen(false)}
        onSaved={(abono) => {
          setAbonos(prev => [abono, ...prev])
          cargar()
        }}
      />

      <DeudaForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(d) => setDeuda(d)}
        editando={deuda}
      />
    </div>
  )
}
