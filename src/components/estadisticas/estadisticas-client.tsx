'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasHorizontales } from '@/components/estadisticas/barras-horizontales'
import { BarrasMensuales } from '@/components/dashboard/barras-mensuales'
import { LineaBalance } from '@/components/estadisticas/linea-balance'
import { Loader2, ChevronDown, X } from 'lucide-react'

type GrupoFiltro = 'todos' | 'necesidad' | 'gusto' | 'otro'
type Periodo = 'mes-actual' | 'mes-anterior' | '3-meses' | '6-meses' | 'año'

interface TxRaw {
  tipo: string
  monto: number
  fecha: string
  establecimiento: string | null
  categories: { nombre: string; color: string; grupo: string } | null
}

interface MesDato { mes: string; balance: number }
interface CuentaDato { nombre: string; tipo: string; saldo_actual: number | null }

const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const PERIODOS: { key: Periodo; label: string }[] = [
  { key: 'mes-actual',   label: 'Este mes' },
  { key: 'mes-anterior', label: 'Mes anterior' },
  { key: '3-meses',      label: '3 meses' },
  { key: '6-meses',      label: '6 meses' },
  { key: 'año',          label: 'Este año' },
]

const GRUPOS: { key: GrupoFiltro; label: string; emoji: string }[] = [
  { key: 'todos',     label: 'Todos',       emoji: '📊' },
  { key: 'necesidad', label: 'Necesidades', emoji: '🏠' },
  { key: 'gusto',     label: 'Gustos',      emoji: '🎉' },
  { key: 'otro',      label: 'Otros',       emoji: '📦' },
]

const COLORES_EST = [
  '#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981',
  '#6366f1','#f97316','#06b6d4','#84cc16','#ec4899',
]

const GRUPO_META = {
  necesidad: { label: 'Necesidades 🏠', color: '#3b82f6' },
  gusto:     { label: 'Gustos 🎉',      color: '#a855f7' },
  otro:      { label: 'Otros 📦',        color: '#6b7280' },
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getRango(periodo: Periodo): { inicio: string; fin: string; label: string; dias: number; multiMes: boolean } {
  const now = new Date()
  const hoy = fmtDate(now)

  function diasEntre(ini: string, fin: string) {
    const start = new Date(ini + 'T00:00:00')
    const end   = new Date(Math.min(new Date(fin + 'T00:00:00').getTime(), now.getTime()))
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1)
  }

  switch (periodo) {
    case 'mes-actual': {
      const inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      const fin    = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
      return { inicio, fin, label: now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }), dias: now.getDate(), multiMes: false }
    }
    case 'mes-anterior': {
      const d      = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const inicio = fmtDate(d)
      const fin    = fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0))
      return { inicio, fin, label: d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }), dias: diasEntre(inicio, fin), multiMes: false }
    }
    case '3-meses': {
      const d      = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      const inicio = fmtDate(d)
      return { inicio, fin: hoy, label: 'Últimos 3 meses', dias: diasEntre(inicio, hoy), multiMes: true }
    }
    case '6-meses': {
      const d      = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const inicio = fmtDate(d)
      return { inicio, fin: hoy, label: 'Últimos 6 meses', dias: diasEntre(inicio, hoy), multiMes: true }
    }
    case 'año': {
      const inicio = `${now.getFullYear()}-01-01`
      return { inicio, fin: hoy, label: `Año ${now.getFullYear()}`, dias: diasEntre(inicio, hoy), multiMes: true }
    }
  }
}

interface Props {
  txMes: TxRaw[]
  datosMeses: MesDato[]
  cuentas: CuentaDato[]
}

export function EstadisticasClient({ txMes: initialTx, datosMeses, cuentas }: Props) {
  const [grupo,     setGrupo]    = useState<GrupoFiltro>('todos')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [periodo,   setPeriodo]  = useState<Periodo>('mes-actual')
  const [txData,    setTxData]   = useState<TxRaw[]>(initialTx)
  const [loading,   setLoading]  = useState(false)

  const { inicio, fin, label: periodoLabel, dias, multiMes } = useMemo(() => getRango(periodo), [periodo])

  useEffect(() => {
    setCategoria(null) // resetear categoría al cambiar periodo
    if (periodo === 'mes-actual') {
      setTxData(initialTx)
      return
    }
    let cancelled = false
    setLoading(true)
    const supabase = createClient()
    supabase
      .from('transactions')
      .select('tipo, monto, fecha, establecimiento, categories(nombre, color, grupo)')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .then(({ data }) => {
        if (cancelled) return
        setTxData(
          (data ?? []).map(t => ({
            tipo: t.tipo,
            monto: t.monto,
            fecha: t.fecha,
            establecimiento: t.establecimiento ?? null,
            categories: (t.categories as unknown) as { nombre: string; color: string; grupo: string } | null,
          }))
        )
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [periodo, inicio, fin, initialTx])

  // Categorías disponibles según el periodo y grupo activo
  const categoriasDisponibles = useMemo(() => {
    const seen = new Map<string, { nombre: string; color: string }>()
    for (const t of txData) {
      if (t.tipo !== 'egreso' || !t.categories?.nombre) continue
      if (grupo !== 'todos' && (t.categories.grupo ?? 'otro') !== grupo) continue
      if (!seen.has(t.categories.nombre)) {
        seen.set(t.categories.nombre, { nombre: t.categories.nombre, color: t.categories.color })
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [txData, grupo])

  const { totalIngresos, totalEgresos, tasaAhorro, datosCat, datosGrupo, datosEstablecimiento, datosMensuales } =
    useMemo(() => {
      const egresos  = txData.filter(t => t.tipo === 'egreso')
      const ingresos = txData.filter(t => t.tipo === 'ingreso')

      const egresosFiltrados = egresos.filter(t => {
        const matchGrupo = grupo === 'todos' || (t.categories?.grupo ?? 'otro') === grupo
        const matchCat   = !categoria || t.categories?.nombre === categoria
        return matchGrupo && matchCat
      })

      const totalIngresos = ingresos.reduce((s, t) => s + t.monto, 0)
      const totalEgresos  = egresosFiltrados.reduce((s, t) => s + t.monto, 0)
      const tasaAhorro    = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos * 100) : 0

      // Por categoría
      const mapCat: Record<string, { valor: number; color: string }> = {}
      for (const t of egresosFiltrados) {
        const key   = t.categories?.nombre ?? 'Sin categoría'
        const color = t.categories?.color  ?? '#6b7280'
        mapCat[key] = { valor: (mapCat[key]?.valor ?? 0) + t.monto, color }
      }
      const datosCat = Object.entries(mapCat)
        .map(([nombre, { valor, color }]) => ({ nombre, valor, color }))
        .sort((a, b) => b.valor - a.valor)

      // Dona Necesidades vs Gustos
      const mapGrupo: Record<string, number> = {}
      for (const t of egresosFiltrados) {
        const g = t.categories?.grupo ?? 'otro'
        mapGrupo[g] = (mapGrupo[g] ?? 0) + t.monto
      }
      const datosGrupo = Object.entries(mapGrupo)
        .filter(([, v]) => v > 0)
        .map(([k, valor]) => ({
          nombre: GRUPO_META[k as keyof typeof GRUPO_META]?.label ?? k,
          valor,
          color:  GRUPO_META[k as keyof typeof GRUPO_META]?.color ?? '#6b7280',
        }))

      // Por establecimiento (top 10)
      const mapEst: Record<string, number> = {}
      for (const t of egresosFiltrados) {
        const est = t.establecimiento?.trim()
        if (!est) continue
        mapEst[est] = (mapEst[est] ?? 0) + t.monto
      }
      const datosEstablecimiento = Object.entries(mapEst)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([nombre, valor], i) => ({ nombre, valor, color: COLORES_EST[i % COLORES_EST.length] }))

      // Ingresos vs egresos por mes (para periodos multi-mes)
      const mapMes: Record<string, { mes: string; ingresos: number; egresos: number }> = {}
      for (const t of txData) {
        const [y, m] = t.fecha.split('-')
        const key      = `${y}-${m}`
        const mesLabel = MESES_SHORT[parseInt(m) - 1]
        if (!mapMes[key]) mapMes[key] = { mes: mesLabel, ingresos: 0, egresos: 0 }
        if (t.tipo === 'ingreso') {
          mapMes[key].ingresos += t.monto
        } else {
          const matchGrupo = grupo === 'todos' || (t.categories?.grupo ?? 'otro') === grupo
          const matchCat   = !categoria || t.categories?.nombre === categoria
          if (matchGrupo && matchCat) mapMes[key].egresos += t.monto
        }
      }
      const datosMensuales = Object.entries(mapMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v)

      return { totalIngresos, totalEgresos, tasaAhorro, datosCat, datosGrupo, datosEstablecimiento, datosMensuales }
    }, [txData, grupo, categoria])

  const totalSaldos = cuentas.reduce((s, c) => s + (c.saldo_actual ?? 0), 0)
  const grupoLabel  = GRUPOS.find(g => g.key === grupo)?.label ?? ''
  const hayFiltros  = grupo !== 'todos' || !!categoria

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-500 capitalize">{periodoLabel}</p>
      </div>

      {/* ── Filtros ── */}
      {/* Periodo */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriodo(p.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
              periodo === p.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Grupo */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
        {GRUPOS.map(g => (
          <button
            key={g.key}
            onClick={() => { setGrupo(g.key); setCategoria(null) }}
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

      {/* Categoría */}
      <div className="relative">
        <select
          value={categoria ?? ''}
          onChange={e => setCategoria(e.target.value || null)}
          className="w-full appearance-none bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-emerald-400 pr-10 cursor-pointer"
        >
          <option value="">Todas las categorías</option>
          {categoriasDisponibles.map(cat => (
            <option key={cat.nombre} value={cat.nombre}>{cat.nombre}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>

      {/* Badge de filtros activos */}
      {hayFiltros && (
        <div className="flex flex-wrap gap-2">
          {grupo !== 'todos' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
              {GRUPOS.find(g => g.key === grupo)?.emoji} {grupoLabel}
              <button onClick={() => setGrupo('todos')}><X className="h-3 w-3" /></button>
            </span>
          )}
          {categoria && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
              {categoria}
              <button onClick={() => setCategoria(null)}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando {periodoLabel.toLowerCase()}…
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">
            {grupo === 'todos' && !categoria ? 'Tasa de ahorro' : `Ahorro vs filtro`}
          </p>
          <p className={`text-2xl font-bold mt-1 ${tasaAhorro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {tasaAhorro.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">de los ingresos</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">Gasto/día</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">{formatCOP(totalEgresos / dias)}</p>
          <p className="text-xs text-gray-400 mt-1">{dias} días · {formatCOP(totalEgresos)} total</p>
        </div>
      </div>

      {/* ── Ingreso vs Egreso por mes (solo multi-mes) ── */}
      {multiMes && datosMensuales.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Ingreso vs Egreso por mes</h2>
          <p className="text-xs text-gray-400 mb-3 capitalize">
            {periodoLabel}{hayFiltros ? ` · filtrado` : ''}
          </p>
          <BarrasMensuales datos={datosMensuales} />
        </div>
      )}

      {/* ── Necesidades vs Gustos (solo cuando no hay filtro de categoría específica) ── */}
      {!categoria && grupo === 'todos' && datosGrupo.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Necesidades vs Gustos</h2>
          <p className="text-xs text-gray-400 mb-4 capitalize">{periodoLabel}</p>
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

      {/* ── Egresos por categoría ── */}
      {datosCat.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Egresos por categoría</h2>
          <p className="text-xs text-gray-400 mb-4 capitalize">{periodoLabel}</p>
          <BarrasHorizontales datos={datosCat} />
        </div>
      )}

      {/* ── Dona de distribución (solo si hay más de 1 categoría) ── */}
      {datosCat.length > 1 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Distribución de egresos</h2>
          <DonutCategorias datos={datosCat.slice(0, 7)} />
        </div>
      )}

      {/* ── Por establecimiento ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Por establecimiento</h2>
        <p className="text-xs text-gray-400 mb-4 capitalize">Dónde más gastas · {periodoLabel}</p>
        {datosEstablecimiento.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">Sin establecimientos registrados</p>
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

      {/* ── Tendencia de balance (siempre últimos 6 meses, sin filtrar) ── */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Tendencia del balance</h2>
        <p className="text-xs text-gray-400 mb-3">Últimos 6 meses</p>
        <LineaBalance datos={datosMeses} />
      </div>

      {/* ── Saldos por cuenta ── */}
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
