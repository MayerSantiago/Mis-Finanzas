'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import type { Transaccion, Categoria, Cuenta, TipoMovimiento } from '@/types'
import { MovimientoForm } from './movimiento-form'
import { Button } from '@/components/ui/button'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight } from 'lucide-react'

interface Props {
  transacciones: Transaccion[]
  categorias: Categoria[]
  cuentas: Cuenta[]
}

function getMesActual() {
  const now = new Date()
  return { anio: now.getFullYear(), mes: now.getMonth() }
}

function formatFechaGrupo(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number)
  const fecha = new Date(anio, mes - 1, dia)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (fecha.getTime() === hoy.getTime()) return 'Hoy'
  if (fecha.getTime() === ayer.getTime()) return 'Ayer'
  return fecha.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
}

export function MovimientosClient({ transacciones: initial, categorias, cuentas }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [{ anio, mes }, setMes] = useState(getMesActual)
  const [transacciones, setTransacciones] = useState(initial)
  const [filtradas, setFiltradas] = useState(initial)
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | 'todos'>('todos')
  const [formOpen, setFormOpen] = useState(false)
  const [editando, setEditando] = useState<Transaccion | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Abrir form si viene ?nuevo=1 en la URL
  useEffect(() => {
    if (searchParams.get('nuevo') === '1') {
      setFormOpen(true)
      router.replace('/movimientos')
    }
  }, [searchParams])

  // Filtrar por mes y tipo
  useEffect(() => {
    let list = transacciones.filter(t => {
      const [a, m] = t.fecha.split('-').map(Number)
      return a === anio && m === mes + 1
    })
    if (filtroTipo !== 'todos') list = list.filter(t => t.tipo === filtroTipo)
    setFiltradas(list.sort((a, b) => b.fecha.localeCompare(a.fecha)))
  }, [transacciones, anio, mes, filtroTipo])

  // Cargar mes nuevo desde Supabase cuando cambia el mes
  const cargarMes = useCallback(async (a: number, m: number) => {
    const supabase = createClient()
    const inicio = `${a}-${String(m + 1).padStart(2, '0')}-01`
    const fin = new Date(a, m + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('transactions')
      .select('*, categories(*), accounts(*)')
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: false })
    if (data) setTransacciones(data as Transaccion[])
  }, [])

  function cambiarMes(delta: number) {
    setMes(prev => {
      const d = new Date(prev.anio, prev.mes + delta)
      const next = { anio: d.getFullYear(), mes: d.getMonth() }
      cargarMes(next.anio, next.mes)
      return next
    })
  }

  function onSaved(t: Transaccion) {
    setTransacciones(prev => {
      const existe = prev.find(x => x.id === t.id)
      return existe ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev]
    })
  }

  async function confirmarEliminar() {
    if (!deleteId) return
    const supabase = createClient()
    const { error } = await supabase.from('transactions').delete().eq('id', deleteId)
    if (!error) setTransacciones(prev => prev.filter(t => t.id !== deleteId))
    setDeleteId(null)
  }

  // Totales del mes filtrado
  const totalIngresos = filtradas.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalEgresos  = filtradas.filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)

  // Agrupar por fecha
  const grupos = filtradas.reduce<Record<string, Transaccion[]>>((acc, t) => {
    (acc[t.fecha] ??= []).push(t)
    return acc
  }, {})

  const nombreMes = new Date(anio, mes).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Movimientos</h1>
        <Button onClick={() => { setEditando(null); setFormOpen(true) }} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Nuevo
        </Button>
      </div>

      {/* Selector de mes */}
      <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 mb-4">
        <button onClick={() => cambiarMes(-1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="font-semibold text-gray-800 capitalize">{nombreMes}</span>
        <button onClick={() => cambiarMes(1)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Resumen ingresos / egresos */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-emerald-50 rounded-2xl p-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
          <div>
            <p className="text-[10px] text-emerald-700">Ingresos</p>
            <p className="font-bold text-emerald-700 text-sm">{formatCOP(totalIngresos)}</p>
          </div>
        </div>
        <div className="bg-red-50 rounded-2xl p-3 flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-red-500 shrink-0" />
          <div>
            <p className="text-[10px] text-red-600">Egresos</p>
            <p className="font-bold text-red-600 text-sm">{formatCOP(totalEgresos)}</p>
          </div>
        </div>
      </div>

      {/* Filtro tipo */}
      <div className="flex gap-2 mb-4">
        {(['todos', 'egreso', 'ingreso'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltroTipo(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
              ${filtroTipo === f
                ? f === 'egreso' ? 'bg-red-500 text-white'
                  : f === 'ingreso' ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
          >
            {f === 'todos' ? 'Todos' : f === 'egreso' ? 'Egresos' : 'Ingresos'}
          </button>
        ))}
      </div>

      {/* Lista agrupada por fecha */}
      {filtradas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Sin movimientos este mes</p>
          <p className="text-sm mt-1">Registra uno con el botón "Nuevo" o el botón + del menú</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grupos).map(([fecha, items]) => (
            <div key={fecha}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
                {formatFechaGrupo(fecha)}
              </p>
              <div className="space-y-2">
                {items.map(t => {
                  const cat = t.categories as Categoria | null
                  const cuenta = t.accounts as Cuenta | null
                  return (
                    <div key={t.id} className="bg-white rounded-2xl p-3.5 shadow-sm border border-gray-100 flex items-center gap-3">
                      {/* Ícono categoría */}
                      <span
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                        style={cat ? { backgroundColor: cat.color + '22', color: cat.color } : { backgroundColor: '#f3f4f6' }}
                      >
                        {cat?.icono || (t.tipo === 'ingreso' ? '💰' : '💸')}
                      </span>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {t.establecimiento || cat?.nombre || (t.tipo === 'ingreso' ? 'Ingreso' : 'Egreso')}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {cat?.nombre}{cat && cuenta ? ' · ' : ''}{cuenta?.nombre}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${t.tipo === 'ingreso' ? 'text-emerald-600' : 'text-red-500'}`}>
                          {t.tipo === 'ingreso' ? '+' : '-'}{formatCOP(t.monto)}
                        </p>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => { setEditando(t); setFormOpen(true) }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteId(t.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <MovimientoForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditando(null) }}
        onSaved={onSaved}
        categorias={categorias}
        cuentas={cuentas}
        editando={editando}
      />

      {/* Confirmar eliminar */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
