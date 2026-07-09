'use client'

import { useState, useMemo } from 'react'
import { formatCOP } from '@/lib/format'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasHorizontales } from '@/components/estadisticas/barras-horizontales'
import { LineaBalance } from '@/components/estadisticas/linea-balance'

type GrupoFiltro = 'todos' | 'necesidad' | 'gusto' | 'otro'

interface TxRaw {
  tipo: string
  monto: number
  establecimiento: string | null
  categories: { nombre: string; color: string; grupo: string } | null
}

interface MesDato { mes: string; balance: number }
interface CuentaDato { nombre: string; tipo: string; saldo_actual: number | null }

const GRUPOS: { key: GrupoFiltro; label: string; emoji: string }[] = [
  { key: 'todos',     label: 'Todos',        emoji: '📊' },
  { key: 'necesidad', label: 'Necesidades',  emoji: '🏠' },
  { key: 'gusto',     label: 'Gustos',       emoji: '🎉' },
  { key: 'otro',      label: 'Otros',        emoji: '📦' },
]

const COLORES_ESTABLECIMIENTO = [
  '#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981',
  '#6366f1','#f97316','#06b6d4','#84cc16','#ec4899',
]

interface Props {
  txMes: TxRaw[]
  datosMeses: MesDato[]
  cuentas: CuentaDato[]
  nombreMes: string
}

export function EstadisticasClient({ txMes, datosMeses, cuentas, nombreMes }: Props) {
  const [grupo, setGrupo] = useState<GrupoFiltro>('todos')

  const { totalIngresos, totalEgresos, tasaAhorro, datosCat, datosGrupo, datosEstablecimiento } =
    useMemo(() => {
      const egresos = txMes.filter(t => t.tipo === 'egreso')
      const ingresos = txMes.filter(t => t.tipo === 'ingreso')

      const egresosFiltrados = grupo === 'todos'
        ? egresos
        : egresos.filter(t => (t.categories?.grupo ?? 'otro') === grupo)

      const totalIngresos = ingresos.reduce((s, t) => s + t.monto, 0)
      const totalEgresos  = egresosFiltrados.reduce((s, t) => s + t.monto, 0)
      const tasaAhorro    = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos * 100) : 0

      // Egresos por categoría
      const mapCat: Record<string, { valor: number; color: string }> = {}
      for (const t of egresosFiltrados) {
        const key   = t.categories?.nombre ?? 'Sin categoría'
        const color = t.categories?.color  ?? '#6b7280'
        mapCat[key] = { valor: (mapCat[key]?.valor ?? 0) + t.monto, color }
      }
      const datosCat = Object.entries(mapCat)
        .map(([nombre, { valor, color }]) => ({ nombre, valor, color }))
        .sort((a, b) => b.valor - a.valor)

      // Egresos por grupo
      const mapGrupo: Record<string, number> = {}
      for (const t of egresos) {
        if (grupo !== 'todos' && (t.categories?.grupo ?? 'otro') !== grupo) continue
        const g = t.categories?.grupo ?? 'otro'
        mapGrupo[g] = (mapGrupo[g] ?? 0) + t.monto
      }
      const GRUPO_META = {
        necesidad: { label: 'Necesidades 🏠', color: '#3b82f6' },
        gusto:     { label: 'Gustos 🎉',       color: '#a855f7' },
        otro:      { label: 'Otros 📦',         color: '#6b7280' },
      }
      const datosGrupo = Object.entries(mapGrupo)
        .filter(([, v]) => v > 0)
        .map(([k, valor]) => ({
          nombre: GRUPO_META[k as keyof typeof GRUPO_META]?.label ?? k,
          valor,
          color:  GRUPO_META[k as keyof typeof GRUPO_META]?.color ?? '#6b7280',
        }))

      // Egresos por establecimiento (top 10)
      const mapEst: Record<string, number> = {}
      for (const t of egresosFiltrados) {
        const est = t.establecimiento?.trim()
        if (!est) continue
        mapEst[est] = (mapEst[est] ?? 0) + t.monto
      }
      const datosEstablecimiento = Object.entries(mapEst)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([nombre, valor], i) => ({
          nombre,
          valor,
          color: COLORES_ESTABLECIMIENTO[i % COLORES_ESTABLECIMIENTO.length],
        }))

      return { totalIngresos, totalEgresos, tasaAhorro, datosCat, datosGrupo, datosEstablecimiento }
    }, [txMes, grupo])

  const totalSaldos = cuentas.reduce((s, c) => s + (c.saldo_actual ?? 0), 0)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-500 capitalize">{nombreMes}</p>
      </div>

      {/* Filtro por grupo */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {GRUPOS.map(g => (
          <button
            key={g.key}
            onClick={() => setGrupo(g.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              grupo === g.key
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <span>{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">
            {grupo === 'todos' ? 'Tasa de ahorro' : `Ahorro vs ${GRUPOS.find(g2 => g2.key === grupo)?.label}`}
          </p>
          <p className={`text-2xl font-bold mt-1 ${tasaAhorro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {tasaAhorro.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">de los ingresos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">Gasto{grupo !== 'todos' ? ` en ${GRUPOS.find(g2 => g2.key === grupo)?.label.toLowerCase()}` : ''}/día</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">
            {formatCOP(totalEgresos / new Date().getDate())}
          </p>
          <p className="text-xs text-gray-400 mt-1">en lo que va del mes</p>
        </div>
      </div>

      {/* Necesidades vs Gustos (solo visible cuando filtro = todos) */}
      {grupo === 'todos' && datosGrupo.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Necesidades vs Gustos</h2>
          <p className="text-xs text-gray-400 mb-4">Distribución de egresos del mes</p>
          <DonutCategorias datos={datosGrupo} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {datosGrupo.map(g => (
              <div key={g.nombre} className="rounded-xl p-3" style={{ backgroundColor: g.color + '15' }}>
                <p className="text-xs font-medium" style={{ color: g.color }}>{g.nombre}</p>
                <p className="font-bold text-gray-800 text-sm">{formatCOP(g.valor)}</p>
                <p className="text-[10px] text-gray-400">
                  {totalEgresos > 0 ? ((g.valor / totalEgresos) * 100).toFixed(1) : 0}% del total
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Egresos por categoría */}
      {datosCat.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Egresos por categoría</h2>
          <p className="text-xs text-gray-400 mb-4 capitalize">{nombreMes}</p>
          <BarrasHorizontales datos={datosCat} />
        </div>
      )}

      {/* Dona categorías */}
      {datosCat.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Distribución de egresos</h2>
          <DonutCategorias datos={datosCat.slice(0, 7)} />
        </div>
      )}

      {/* Por establecimiento */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Por establecimiento</h2>
        <p className="text-xs text-gray-400 mb-4">Dónde más gastas este mes</p>
        {datosEstablecimiento.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">
            Sin establecimientos registrados este mes
          </p>
        ) : (
          <>
            <BarrasHorizontales datos={datosEstablecimiento} />
            <div className="mt-3 space-y-1.5">
              {datosEstablecimiento.map((e, i) => (
                <div key={e.nombre} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 w-4 text-right">{i + 1}.</span>
                    <span className="text-gray-700 font-medium truncate max-w-[160px]">{e.nombre}</span>
                  </div>
                  <span className="text-gray-600 font-semibold shrink-0">{formatCOP(e.valor)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Línea de balance */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Tendencia del balance</h2>
        <p className="text-xs text-gray-400 mb-3">Últimos 6 meses</p>
        <LineaBalance datos={datosMeses} />
      </div>

      {/* Saldos cuentas */}
      {cuentas.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Saldo por cuenta</h2>
          <div className="space-y-3">
            {cuentas.map(c => {
              const pct = totalSaldos !== 0 ? Math.abs((c.saldo_actual ?? 0) / totalSaldos * 100) : 0
              return (
                <div key={c.nombre}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{c.nombre}</span>
                    <span className="font-semibold text-gray-800">{formatCOP(c.saldo_actual)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
