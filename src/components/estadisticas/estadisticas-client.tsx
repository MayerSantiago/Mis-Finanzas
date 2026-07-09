'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/format'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasHorizontales } from '@/components/estadisticas/barras-horizontales'
import { BarrasMensuales } from '@/components/dashboard/barras-mensuales'
import { LineaBalance } from '@/components/estadisticas/linea-balance'
import { Loader2, ChevronDown, X, TrendingUp, TrendingDown, Wallet, SlidersHorizontal } from 'lucide-react'
import { PERSONA_GRUPOS } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

type GrupoFiltro = 'todos' | 'necesidad' | 'gusto' | 'otro'

interface TxRaw {
  tipo: string
  monto: number
  fecha: string
  establecimiento: string | null
  persona_grupo: string | null
  categories: {
    nombre: string; color: string; grupo: string
    macro_categories: { nombre: string; color: string; icono: string | null } | null
  } | null
}

interface MesDato   { mes: string; balance: number }
interface CuentaDato { nombre: string; tipo: string; saldo_actual: number | null }

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const MESES_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

const COLORES_EST = ['#3b82f6','#8b5cf6','#f59e0b','#ef4444','#10b981','#6366f1','#f97316','#06b6d4','#84cc16','#ec4899']
const GRUPO_META = {
  necesidad: { label: 'Necesidades 🏠', color: '#3b82f6' },
  gusto:     { label: 'Gustos 🎉',      color: '#a855f7' },
  otro:      { label: 'Otros 📦',        color: '#6b7280' },
}
const GRUPOS: { key: GrupoFiltro; label: string; emoji: string }[] = [
  { key: 'todos',     label: 'Todos',       emoji: '📊' },
  { key: 'necesidad', label: 'Necesidades', emoji: '🏠' },
  { key: 'gusto',     label: 'Gustos',      emoji: '🎉' },
  { key: 'otro',      label: 'Otros',       emoji: '📦' },
]

const PRESETS = [
  { key: 'hoy',     label: 'Hoy' },
  { key: 'ayer',    label: 'Ayer' },
  { key: 'semana',  label: 'Esta semana' },
  { key: '7d',      label: 'Últimos 7 días' },
  { key: 'mes',     label: 'Este mes' },
  { key: 'mes-ant', label: 'Mes anterior' },
  { key: '30d',     label: 'Últimos 30 días' },
  { key: '90d',     label: 'Últimos 90 días' },
  { key: 'año',     label: 'Este año' },
]

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getPresetRange(key: string): { inicio: string; fin: string } {
  const now = new Date()
  const hoy = fmtDate(now)
  switch (key) {
    case 'hoy':    return { inicio: hoy, fin: hoy }
    case 'ayer': { const d = new Date(now); d.setDate(d.getDate()-1); const s = fmtDate(d); return { inicio: s, fin: s } }
    case 'semana': { const d = new Date(now); const diff = now.getDay()===0 ? -6 : 1-now.getDay(); d.setDate(d.getDate()+diff); return { inicio: fmtDate(d), fin: hoy } }
    case '7d':    { const d = new Date(now); d.setDate(d.getDate()-6); return { inicio: fmtDate(d), fin: hoy } }
    case 'mes':   return { inicio: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`, fin: hoy }
    case 'mes-ant': { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return { inicio: fmtDate(d), fin: fmtDate(new Date(d.getFullYear(), d.getMonth()+1, 0)) } }
    case '30d':   { const d = new Date(now); d.setDate(d.getDate()-29); return { inicio: fmtDate(d), fin: hoy } }
    case '90d':   { const d = new Date(now); d.setDate(d.getDate()-89); return { inicio: fmtDate(d), fin: hoy } }
    case 'año':   return { inicio: `${now.getFullYear()}-01-01`, fin: hoy }
    default:      return { inicio: hoy, fin: hoy }
  }
}

function fmtLabel(fecha: string) {
  const [y, m, d] = fecha.split('-')
  const dt = new Date(parseInt(y), parseInt(m)-1, parseInt(d))
  return `${DIAS_SEMANA[dt.getDay()]} ${parseInt(d)} ${MESES_SHORT[parseInt(m)-1]}`
}

function periodoLabel(ini: string, fin: string) {
  if (ini === fin) return fmtLabel(ini)
  const [y1,m1,d1] = ini.split('-')
  const [y2,m2,d2] = fin.split('-')
  if (y1 === y2 && m1 === m2) return `${parseInt(d1)}–${parseInt(d2)} ${MESES[parseInt(m1)-1]} ${y1}`
  return `${parseInt(d1)} ${MESES_SHORT[parseInt(m1)-1]} ${y1} — ${parseInt(d2)} ${MESES_SHORT[parseInt(m2)-1]} ${y2}`
}

interface Props {
  txMes: TxRaw[]
  datosMeses: MesDato[]
  cuentas: CuentaDato[]
}

export function EstadisticasClient({ txMes: initialTx, datosMeses, cuentas }: Props) {
  const now = new Date()
  const defaultInicio = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const defaultFin    = fmtDate(now)

  const [grupo,        setGrupo]        = useState<GrupoFiltro>('todos')
  const [categorias,   setCategorias]   = useState<string[]>([])
  const [catExpandido, setCatExpandido] = useState(false)
  const [fechaInicio,  setFechaInicio]  = useState(defaultInicio)
  const [fechaFin,     setFechaFin]     = useState(defaultFin)
  const [presetActivo, setPresetActivo] = useState<string | null>('mes')
  const [txData,       setTxData]       = useState<TxRaw[]>(initialTx)
  const [loading,      setLoading]      = useState(false)
  const [sidebarOpen,   setSidebarOpen]   = useState(false)
  const [personaFiltro, setPersonaFiltro] = useState<string | null>(null)
  const [macroFiltro,   setMacroFiltro]   = useState<string | null>(null)

  const isDefault = fechaInicio === defaultInicio && fechaFin === defaultFin

  const fetchData = useCallback((ini: string, fin: string) => {
    setLoading(true)
    setCategorias([])
    const supabase = createClient()
    let cancelled = false
    supabase
      .from('transactions')
      .select('*, categories(nombre, color, grupo, macro_categories(nombre, color, icono))')
      .gte('fecha', ini).lte('fecha', fin)
      .then(({ data }) => {
        if (cancelled) return
        setTxData((data ?? []).map(t => ({
          tipo: t.tipo, monto: t.monto, fecha: t.fecha,
          establecimiento: t.establecimiento ?? null,
          persona_grupo: (t as unknown as { persona_grupo: string | null }).persona_grupo ?? null,
          categories: (t.categories as unknown) as TxRaw['categories'],
        })))
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (isDefault) { setTxData(initialTx); return }
    return fetchData(fechaInicio, fechaFin)
  }, [fechaInicio, fechaFin, isDefault, initialTx, fetchData])

  function aplicarPreset(key: string) {
    const { inicio, fin } = getPresetRange(key)
    setPresetActivo(key)
    setFechaInicio(inicio)
    setFechaFin(fin)
  }

  function handleFechaChange(campo: 'inicio' | 'fin', valor: string) {
    setPresetActivo(null)
    if (campo === 'inicio') setFechaInicio(valor)
    else setFechaFin(valor)
  }

  const dias = useMemo(() => {
    const s = new Date(fechaInicio + 'T00:00:00')
    const e = new Date(Math.min(new Date(fechaFin + 'T00:00:00').getTime(), now.getTime()))
    return Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1)
  }, [fechaInicio, fechaFin])

  const rangoDias = useMemo(() => {
    const s = new Date(fechaInicio + 'T00:00:00')
    const e = new Date(fechaFin + 'T00:00:00')
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1
  }, [fechaInicio, fechaFin])

  // granularity: día ≤31d, semana ≤90d, mes >90d
  const granularity = rangoDias <= 31 ? 'dia' : rangoDias <= 90 ? 'semana' : 'mes'

  const categoriasDisponibles = useMemo(() => {
    const seen = new Map<string, { nombre: string; color: string }>()
    for (const t of txData) {
      if (t.tipo !== 'egreso' || !t.categories?.nombre) continue
      if (grupo !== 'todos' && (t.categories.grupo ?? 'otro') !== grupo) continue
      if (!seen.has(t.categories.nombre))
        seen.set(t.categories.nombre, { nombre: t.categories.nombre, color: t.categories.color })
    }
    return Array.from(seen.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [txData, grupo])

  const macrosDisponibles = useMemo(() => {
    const seen = new Map<string, { nombre: string; color: string; icono: string | null }>()
    for (const t of txData) {
      if (t.tipo !== 'egreso') continue
      const mc = t.categories?.macro_categories
      if (mc && !seen.has(mc.nombre)) seen.set(mc.nombre, mc)
    }
    return Array.from(seen.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [txData])

  function toggleCategoria(nombre: string) {
    setCategorias(prev => prev.includes(nombre) ? prev.filter(c => c !== nombre) : [...prev, nombre])
  }

  const {
    totalIngresos, totalEgresos, tasaAhorro,
    datosCat, datosGrupo, datosEstablecimiento,
    datosChart, datosDiarios, datosGrupoChart, datosPersona, datosMacro,
  } = useMemo(() => {
    const egresos  = txData.filter(t => t.tipo === 'egreso')
    const ingresos = txData.filter(t => t.tipo === 'ingreso')

    function matchFiltros(t: TxRaw) {
      const matchGrupo   = grupo === 'todos' || (t.categories?.grupo ?? 'otro') === grupo
      const matchCat     = categorias.length === 0 || categorias.includes(t.categories?.nombre ?? '')
      const matchPersona = personaFiltro === null || t.persona_grupo === personaFiltro
      const matchMacro   = macroFiltro === null || (t.categories?.macro_categories?.nombre ?? null) === macroFiltro
      return matchGrupo && matchCat && matchPersona && matchMacro
    }

    const matchPersonaOnly = (t: TxRaw) => {
      const matchPersona = personaFiltro === null || t.persona_grupo === personaFiltro
      const matchMacro   = macroFiltro === null || (t.categories?.macro_categories?.nombre ?? null) === macroFiltro
      return matchPersona && matchMacro
    }

    const egresosFiltrados  = egresos.filter(matchFiltros)
    const ingresosFiltrados = ingresos.filter(matchPersonaOnly)
    const totalIngresos = ingresosFiltrados.reduce((s, t) => s + t.monto, 0)
    const totalEgresos  = egresosFiltrados.reduce((s, t) => s + t.monto, 0)
    const tasaAhorro    = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos * 100) : 0

    // Categorías
    const mapCat: Record<string, { valor: number; color: string }> = {}
    for (const t of egresosFiltrados) {
      const key = t.categories?.nombre ?? 'Sin categoría'
      mapCat[key] = { valor: (mapCat[key]?.valor ?? 0) + t.monto, color: t.categories?.color ?? '#6b7280' }
    }
    const datosCat = Object.entries(mapCat).map(([nombre, { valor, color }]) => ({ nombre, valor, color })).sort((a, b) => b.valor - a.valor)

    // Grupos
    const mapGrupo: Record<string, number> = {}
    for (const t of egresosFiltrados) {
      const g = t.categories?.grupo ?? 'otro'
      mapGrupo[g] = (mapGrupo[g] ?? 0) + t.monto
    }
    const datosGrupo = Object.entries(mapGrupo).filter(([, v]) => v > 0).map(([k, valor]) => ({
      nombre: GRUPO_META[k as keyof typeof GRUPO_META]?.label ?? k,
      valor,
      color: GRUPO_META[k as keyof typeof GRUPO_META]?.color ?? '#6b7280',
    }))

    // Establecimientos
    const mapEst: Record<string, number> = {}
    for (const t of egresosFiltrados) {
      const est = t.establecimiento?.trim()
      if (!est) continue
      mapEst[est] = (mapEst[est] ?? 0) + t.monto
    }
    const datosEstablecimiento = Object.entries(mapEst).sort(([,a],[,b]) => b-a).slice(0, 10)
      .map(([nombre, valor], i) => ({ nombre, valor, color: COLORES_EST[i % COLORES_EST.length] }))

    // Datos diarios (para tabla detalle)
    const mapDia: Record<string, { fecha: string; label: string; ingresos: number; egresos: number }> = {}
    for (const t of txData) {
      if (!mapDia[t.fecha]) {
        mapDia[t.fecha] = { fecha: t.fecha, label: fmtLabel(t.fecha), ingresos: 0, egresos: 0 }
      }
      if (t.tipo === 'ingreso') mapDia[t.fecha].ingresos += t.monto
      else if (matchFiltros(t)) mapDia[t.fecha].egresos += t.monto
    }
    const datosDiarios = Object.values(mapDia).sort((a, b) => a.fecha.localeCompare(b.fecha))

    // Datos chart (por granularidad: día/semana/mes)
    let datosChart: { mes: string; ingresos: number; egresos: number }[] = []
    if (granularity === 'dia') {
      datosChart = datosDiarios.map(d => ({ mes: d.label, ingresos: d.ingresos, egresos: d.egresos }))
    } else if (granularity === 'semana') {
      const mapSem: Record<string, { mes: string; ingresos: number; egresos: number }> = {}
      for (const t of txData) {
        const d    = new Date(t.fecha + 'T00:00:00')
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
        const lun  = new Date(d); lun.setDate(d.getDate() + diff)
        const key  = fmtDate(lun)
        if (!mapSem[key]) mapSem[key] = { mes: `${parseInt(key.split('-')[2])} ${MESES_SHORT[lun.getMonth()]}`, ingresos: 0, egresos: 0 }
        if (t.tipo === 'ingreso') mapSem[key].ingresos += t.monto
        else if (matchFiltros(t)) mapSem[key].egresos += t.monto
      }
      datosChart = Object.entries(mapSem).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v)
    } else {
      const mapMes: Record<string, { mes: string; ingresos: number; egresos: number }> = {}
      for (const t of txData) {
        const [y, m] = t.fecha.split('-')
        const key = `${y}-${m}`
        if (!mapMes[key]) mapMes[key] = { mes: `${MESES_SHORT[parseInt(m)-1]} ${y}`, ingresos: 0, egresos: 0 }
        if (t.tipo === 'ingreso') mapMes[key].ingresos += t.monto
        else if (matchFiltros(t)) mapMes[key].egresos += t.monto
      }
      datosChart = Object.entries(mapMes).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v)
    }

    // Egresos por macro categoría con detalle de sub-categorías
    const mapMacro: Record<string, {
      nombre: string; color: string; icono: string | null; valor: number
      cats: Record<string, { nombre: string; color: string; valor: number }>
    }> = {}
    for (const t of egresosFiltrados) {
      const mc     = t.categories?.macro_categories
      const key    = mc?.nombre ?? '__sin__'
      const catKey = t.categories?.nombre ?? 'Sin categoría'
      if (!mapMacro[key]) mapMacro[key] = {
        nombre: mc?.nombre ?? 'Sin clasificar',
        color:  mc?.color  ?? '#9ca3af',
        icono:  mc?.icono  ?? null,
        valor: 0, cats: {},
      }
      mapMacro[key].valor += t.monto
      if (!mapMacro[key].cats[catKey]) mapMacro[key].cats[catKey] = { nombre: catKey, color: t.categories?.color ?? '#9ca3af', valor: 0 }
      mapMacro[key].cats[catKey].valor += t.monto
    }
    const datosMacro = Object.values(mapMacro)
      .filter(m => m.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .map(m => ({
        nombre: m.icono ? `${m.icono} ${m.nombre}` : m.nombre,
        valor: m.valor, color: m.color,
        cats: Object.values(m.cats).sort((a, b) => b.valor - a.valor),
      }))

    // Egresos por grupo de persona
    const mapPersona: Record<string, number> = {}
    for (const t of egresosFiltrados) {
      const pg = t.persona_grupo ?? '_sin'
      mapPersona[pg] = (mapPersona[pg] ?? 0) + t.monto
    }
    const datosPersona = Object.entries(mapPersona)
      .filter(([, v]) => v > 0)
      .map(([k, valor]) => {
        const meta = PERSONA_GRUPOS.find(g => g.key === k)
        return { nombre: meta ? `${meta.emoji} ${meta.label}` : 'Sin asignar', valor, color: meta?.color ?? '#9ca3af' }
      })
      .sort((a, b) => b.valor - a.valor)

    // Egresos por tipo de gasto (necesidad/gusto/otro) por periodo
    const mapGrupoChart: Record<string, { periodo: string; necesidad: number; gusto: number; otro: number; _order: string }> = {}
    for (const t of egresosFiltrados) {
      let key: string, periodo: string
      if (granularity === 'dia') {
        key = t.fecha
        periodo = fmtLabel(t.fecha)
      } else if (granularity === 'semana') {
        const d = new Date(t.fecha + 'T00:00:00')
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
        const lun = new Date(d); lun.setDate(d.getDate() + diff)
        key = fmtDate(lun)
        periodo = `${parseInt(key.split('-')[2])} ${MESES_SHORT[lun.getMonth()]}`
      } else {
        const [y, m] = t.fecha.split('-')
        key = `${y}-${m}`
        periodo = `${MESES_SHORT[parseInt(m)-1]} ${y}`
      }
      if (!mapGrupoChart[key]) mapGrupoChart[key] = { periodo, necesidad: 0, gusto: 0, otro: 0, _order: key }
      const g = (t.categories?.grupo ?? 'otro') as 'necesidad' | 'gusto' | 'otro'
      mapGrupoChart[key][g] += t.monto
    }
    const datosGrupoChart = Object.values(mapGrupoChart)
      .sort((a, b) => a._order.localeCompare(b._order))
      .map(({ periodo, necesidad, gusto, otro }) => ({ periodo, necesidad, gusto, otro }))

    return { totalIngresos, totalEgresos, tasaAhorro, datosCat, datosGrupo, datosEstablecimiento, datosChart, datosDiarios, datosGrupoChart, datosPersona, datosMacro }
  }, [txData, grupo, categorias, granularity, personaFiltro, macroFiltro])

  const totalSaldos = cuentas.reduce((s, c) => s + (c.saldo_actual ?? 0), 0)
  const hayFiltros  = grupo !== 'todos' || categorias.length > 0 || personaFiltro !== null || macroFiltro !== null
  const label       = periodoLabel(fechaInicio, fechaFin)
  const granLabel   = granularity === 'dia' ? 'día' : granularity === 'semana' ? 'semana' : 'mes'

  // ── Sidebar de filtros (se reutiliza en mobile y desktop) ──
  const FiltrosContent = (
    <div className="space-y-6">
      {/* Presets */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Acceso rápido</p>
        <div className="grid grid-cols-2 gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => { aplicarPreset(p.key); setSidebarOpen(false) }}
              className={`px-2 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                presetActivo === p.key
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Rango personalizado */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Rango personalizado</p>
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Desde</label>
            <input
              type="date"
              value={fechaInicio}
              max={fechaFin}
              onChange={e => handleFechaChange('inicio', e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hasta</label>
            <input
              type="date"
              value={fechaFin}
              min={fechaInicio}
              max={fmtDate(now)}
              onChange={e => handleFechaChange('fin', e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 bg-white"
            />
          </div>
        </div>
        {!presetActivo && (
          <p className="text-[10px] text-emerald-600 mt-1.5">{dias} día{dias !== 1 ? 's' : ''} seleccionado{dias !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Personas */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Persona / Grupo</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setPersonaFiltro(null)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              personaFiltro === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            👥 Todos
          </button>
          {PERSONA_GRUPOS.map(g => (
            <button
              key={g.key}
              onClick={() => setPersonaFiltro(personaFiltro === g.key ? null : g.key)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                personaFiltro === g.key ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
              style={personaFiltro === g.key ? { backgroundColor: g.color } : {}}
            >
              {g.emoji} {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Macro categoría */}
      {macrosDisponibles.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Macro categoría</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setMacroFiltro(null)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${macroFiltro === null ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              Todas
            </button>
            {macrosDisponibles.map(m => (
              <button
                key={m.nombre}
                onClick={() => setMacroFiltro(macroFiltro === m.nombre ? null : m.nombre)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${macroFiltro === m.nombre ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                style={macroFiltro === m.nombre ? { backgroundColor: m.color } : {}}
              >
                {m.icono && <span>{m.icono}</span>}
                {m.nombre}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grupo */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo de gasto</p>
        <div className="grid grid-cols-2 gap-1.5">
          {GRUPOS.map(g => (
            <button
              key={g.key}
              onClick={() => { setGrupo(g.key); setCategorias([]) }}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                grupo === g.key
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <span>{g.emoji}</span> {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categorías multi-select */}
      <div>
        <button
          onClick={() => setCatExpandido(!catExpandido)}
          className="w-full flex items-center justify-between text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2"
        >
          <span>
            Categorías{' '}
            {categorias.length > 0 && <span className="normal-case text-emerald-600">({categorias.length})</span>}
          </span>
          <div className="flex items-center gap-2">
            {categorias.length > 0 && (
              <span
                role="button"
                onClick={e => { e.stopPropagation(); setCategorias([]) }}
                className="text-gray-400 hover:text-red-500 transition-colors normal-case"
              >
                Limpiar
              </span>
            )}
            <ChevronDown className={`h-3 w-3 transition-transform ${catExpandido ? 'rotate-180' : ''}`} />
          </div>
        </button>
        {catExpandido && (
          <div className="flex flex-wrap gap-1.5">
            {categoriasDisponibles.length === 0 ? (
              <p className="text-xs text-gray-400">Sin datos en este periodo</p>
            ) : categoriasDisponibles.map(cat => {
              const sel = categorias.includes(cat.nombre)
              return (
                <button
                  key={cat.nombre}
                  onClick={() => toggleCategoria(cat.nombre)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${sel ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  style={sel ? { backgroundColor: cat.color } : {}}
                >
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: sel ? 'rgba(255,255,255,0.8)' : cat.color }} />
                  {cat.nombre}
                </button>
              )
            })}
          </div>
        )}
        {/* Badges */}
        {categorias.length > 0 && !catExpandido && (
          <div className="flex flex-wrap gap-1 mt-1">
            {categorias.map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full border border-blue-200">
                {c} <button onClick={() => toggleCategoria(c)}><X className="h-2.5 w-2.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">

      {/* ════ SIDEBAR DESKTOP ════ */}
      <aside className="hidden md:flex flex-col w-72 shrink-0 border-r border-gray-200 bg-white sticky top-0 h-screen overflow-y-auto">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">Estadísticas</h1>
          <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          {loading && <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400"><Loader2 className="h-3 w-3 animate-spin" /> Actualizando…</div>}
        </div>
        <div className="p-5 flex-1">
          {FiltrosContent}
        </div>

        {/* Saldos en sidebar desktop */}
        {cuentas.length > 0 && (
          <div className="p-5 border-t border-gray-100">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Saldos</p>
            <div className="space-y-2.5">
              {cuentas.map(c => {
                const pct = totalSaldos !== 0 ? Math.abs((c.saldo_actual ?? 0) / totalSaldos * 100) : 0
                return (
                  <div key={c.nombre}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-600 truncate max-w-[120px]">{c.nombre}</span>
                      <span className="font-semibold text-gray-800 shrink-0">{formatCOP(c.saldo_actual)}</span>
                    </div>
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </aside>

      {/* ════ CONTENIDO PRINCIPAL ════ */}
      <div className="flex-1 min-w-0 bg-gray-50">

        {/* ── Mobile: header con botón sidebar ── */}
        <div className="md:hidden sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Estadísticas</h1>
            <p className="text-[11px] text-gray-500">{label}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filtros {hayFiltros && <span className="bg-emerald-500 text-white rounded-full px-1.5">!</span>}
          </button>
        </div>

        {/* ── Mobile: panel de filtros colapsable ── */}
        {sidebarOpen && (
          <div className="md:hidden bg-white border-b border-gray-200 p-4">
            {FiltrosContent}
          </div>
        )}

        {loading && (
          <div className="md:hidden flex items-center justify-center gap-2 py-2 text-sm text-gray-400 bg-white">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…
          </div>
        )}

        <div className="p-4 md:p-6 space-y-5">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100">
              <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-emerald-600" /><p className="text-xs text-emerald-600 font-medium">Ingresos</p></div>
              <p className="text-xl font-bold text-emerald-700">{formatCOP(totalIngresos)}</p>
            </div>
            <div className="bg-red-50 rounded-2xl p-4 border border-red-100">
              <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="h-3.5 w-3.5 text-red-500" /><p className="text-xs text-red-500 font-medium">Egresos{hayFiltros ? ' ·filtrado' : ''}</p></div>
              <p className="text-xl font-bold text-red-600">{formatCOP(totalEgresos)}</p>
            </div>
            <div className={`rounded-2xl p-4 border ${(totalIngresos - totalEgresos) >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Wallet className={`h-3.5 w-3.5 ${(totalIngresos-totalEgresos)>=0 ? 'text-blue-500' : 'text-orange-500'}`} />
                <p className={`text-xs font-medium ${(totalIngresos-totalEgresos)>=0 ? 'text-blue-600' : 'text-orange-600'}`}>Balance</p>
              </div>
              <p className={`text-xl font-bold ${(totalIngresos-totalEgresos)>=0 ? 'text-blue-700' : 'text-orange-600'}`}>{formatCOP(totalIngresos - totalEgresos)}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-400">Tasa de ahorro</p>
              <p className={`text-xl font-bold mt-1 ${tasaAhorro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{tasaAhorro.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-0.5">{dias} días · {formatCOP(totalEgresos/dias)}/día</p>
            </div>
          </div>

          {/* ── Filtros activos ── */}
          {hayFiltros && (
            <div className="flex flex-wrap gap-2">
              {macroFiltro !== null && (() => {
                const m = macrosDisponibles.find(x => x.nombre === macroFiltro)
                return (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-white text-xs rounded-full"
                    style={{ backgroundColor: m?.color ?? '#6b7280' }}>
                    {m?.icono} {macroFiltro}
                    <button onClick={() => setMacroFiltro(null)}><X className="h-3 w-3" /></button>
                  </span>
                )
              })()}
              {personaFiltro !== null && (() => {
                const pg = PERSONA_GRUPOS.find(g => g.key === personaFiltro)
                return pg ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 text-white text-xs rounded-full border border-transparent" style={{ backgroundColor: pg.color }}>
                    {pg.emoji} {pg.label}
                    <button onClick={() => setPersonaFiltro(null)}><X className="h-3 w-3" /></button>
                  </span>
                ) : null
              })()}
              {grupo !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-full border border-emerald-200">
                  {GRUPOS.find(g => g.key === grupo)?.emoji} {GRUPOS.find(g => g.key === grupo)?.label}
                  <button onClick={() => setGrupo('todos')}><X className="h-3 w-3" /></button>
                </span>
              )}
              {categorias.map(c => (
                <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full border border-blue-200">
                  {c} <button onClick={() => toggleCategoria(c)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* ── Macro categorías: barras + tabla expandible ── */}
          {datosMacro.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 text-sm">Egresos por macro categoría</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{label} · {datosMacro.length} grupo{datosMacro.length !== 1 ? 's' : ''}</p>
                </div>
                <span className="text-xs font-semibold text-gray-500">{formatCOP(totalEgresos)}</span>
              </div>

              {/* Barras proporcionales */}
              <div className="p-4 md:p-5 space-y-3 border-b border-gray-50">
                {datosMacro.map((m, i) => {
                  const pct = totalEgresos > 0 ? (m.valor / totalEgresos) * 100 : 0
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-medium text-gray-700">{m.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{pct.toFixed(1)}%</span>
                          <span className="font-bold text-gray-800">{formatCOP(m.valor)}</span>
                        </div>
                      </div>
                      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: m.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Tabla resumen compacta */}
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr className="text-gray-400 font-medium">
                    <th className="text-left px-4 md:px-5 py-2.5">Macro</th>
                    <th className="text-right px-4 md:px-5 py-2.5">Total</th>
                    <th className="text-right px-4 md:px-5 py-2.5">%</th>
                    <th className="text-right px-4 md:px-5 py-2.5 hidden md:table-cell">Categorías</th>
                  </tr>
                </thead>
                <tbody>
                  {datosMacro.map((m, i) => {
                    const pct = totalEgresos > 0 ? (m.valor / totalEgresos) * 100 : 0
                    return (
                      <tr key={i} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                        <td className="px-4 md:px-5 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                            <span className="font-medium text-gray-700">{m.nombre}</span>
                          </div>
                        </td>
                        <td className="px-4 md:px-5 py-2.5 text-right font-semibold text-gray-800">{formatCOP(m.valor)}</td>
                        <td className="px-4 md:px-5 py-2.5 text-right">
                          <span className="font-bold px-1.5 py-0.5 rounded-full text-[10px]"
                            style={{ color: m.color, backgroundColor: m.color + '18' }}>
                            {pct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-4 md:px-5 py-2.5 text-right text-gray-400 hidden md:table-cell">
                          {m.cats.length} categoría{m.cats.length !== 1 ? 's' : ''}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr className="font-bold text-xs">
                    <td className="px-4 md:px-5 py-2.5 text-gray-600">Total</td>
                    <td className="px-4 md:px-5 py-2.5 text-right text-red-600">{formatCOP(totalEgresos)}</td>
                    <td className="px-4 md:px-5 py-2.5 text-right text-gray-400">100%</td>
                    <td className="hidden md:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Chart ingresos vs egresos (granularidad automática) ── */}
          {datosChart.length > 0 && (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-800 text-sm">Ingresos vs Egresos</h2>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Por {granLabel}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">{label}</p>
              <BarrasMensuales datos={datosChart} />
            </div>
          )}

          {/* ── Egresos por tipo de gasto (apilado) ── */}
          {datosGrupoChart.length > 0 && (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-800 text-sm">Composición de egresos</h2>
                <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">Por {granLabel}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">Necesidades · Gustos · Otros — {label}</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={datosGrupoChart} barSize={18} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `$${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    content={({ active, payload, label: lbl }) => {
                      if (!active || !payload?.length) return null
                      const total = (payload as unknown as { value: number }[]).reduce((s, p) => s + (p.value ?? 0), 0)
                      return (
                        <div className="bg-white border border-gray-100 shadow-lg rounded-xl px-3 py-2 text-xs space-y-1 min-w-[160px]">
                          <p className="font-semibold text-gray-700 mb-1">{lbl}</p>
                          {(payload as unknown as { name: string; value: number; fill: string }[]).map((p, i) => (
                            <div key={i} className="flex items-center justify-between gap-4">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.fill }} />
                                <span className="text-gray-600">{p.name}</span>
                              </span>
                              <span className="font-semibold text-gray-800">{formatCOP(p.value)}</span>
                            </div>
                          ))}
                          <div className="border-t border-gray-100 pt-1 flex justify-between font-bold text-gray-700">
                            <span>Total</span><span>{formatCOP(total)}</span>
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Legend formatter={v => <span className="text-xs text-gray-600">{v}</span>} iconType="circle" iconSize={8} />
                  <Bar dataKey="necesidad" name="Necesidades" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="gusto"     name="Gustos"      stackId="a" fill="#a855f7" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="otro"      name="Otros"       stackId="a" fill="#6b7280" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Desktop: dos columnas para categorías y establecimientos ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {datosCat.length > 0 && (
              <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm mb-1">Egresos por categoría</h2>
                <p className="text-xs text-gray-400 mb-4">{label}</p>
                <BarrasHorizontales datos={datosCat} />
              </div>
            )}
            {datosEstablecimiento.length > 0 && (
              <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm mb-1">Por establecimiento</h2>
                <p className="text-xs text-gray-400 mb-4">Top 10 · {label}</p>
                <BarrasHorizontales datos={datosEstablecimiento} />
              </div>
            )}
          </div>

          {/* ── Egresos por persona ── */}
          {datosPersona.length > 0 && (
            <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-semibold text-gray-800 text-sm">Egresos por persona / grupo</h2>
                <span className="text-xs text-gray-400">{label}</span>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                {formatCOP(datosPersona.reduce((s, d) => s + d.valor, 0))} total
              </p>
              <div className="space-y-3">
                {datosPersona.map(d => {
                  const total = datosPersona.reduce((s, x) => s + x.valor, 0)
                  const pct   = total > 0 ? (d.valor / total) * 100 : 0
                  return (
                    <div key={d.nombre}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-700 font-medium">{d.nombre}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{pct.toFixed(0)}%</span>
                          <span className="font-semibold text-gray-800">{formatCOP(d.valor)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: d.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Dona distribución + Necesidades vs Gustos ── */}
          {datosCat.length > 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm mb-1">Distribución de egresos</h2>
                <DonutCategorias datos={datosCat.slice(0, 7)} />
              </div>
              {categorias.length === 0 && grupo === 'todos' && datosGrupo.length > 0 && (
                <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
                  <h2 className="font-semibold text-gray-800 text-sm mb-1">Necesidades vs Gustos</h2>
                  <DonutCategorias datos={datosGrupo} />
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {datosGrupo.map(g => (
                      <div key={g.nombre} className="rounded-xl p-2 text-center" style={{ backgroundColor: g.color + '15' }}>
                        <p className="font-bold text-gray-800 text-xs">{formatCOP(g.valor)}</p>
                        <p className="text-[10px] text-gray-400">{totalEgresos > 0 ? ((g.valor/totalEgresos)*100).toFixed(0) : 0}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tabla resumen por categoría ── */}
          {datosCat.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 text-sm">Resumen por categoría</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Egresos · {label}</p>
                </div>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                  {datosCat.length} categoría{datosCat.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-400 font-medium">
                      <th className="text-left px-4 md:px-5 py-3 w-8">#</th>
                      <th className="text-left px-4 md:px-5 py-3">Categoría</th>
                      <th className="text-right px-4 md:px-5 py-3">Valor</th>
                      <th className="text-right px-4 md:px-5 py-3">% del total</th>
                      <th className="px-4 md:px-5 py-3 w-28 hidden md:table-cell"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {datosCat.map((c, i) => {
                      const pct = totalEgresos > 0 ? (c.valor / totalEgresos) * 100 : 0
                      return (
                        <tr key={c.nombre} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                          <td className="px-4 md:px-5 py-2.5 text-gray-300 text-xs font-medium">{i + 1}</td>
                          <td className="px-4 md:px-5 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                              <span className="text-gray-700 font-medium">{c.nombre}</span>
                            </div>
                          </td>
                          <td className="px-4 md:px-5 py-2.5 text-right font-semibold text-gray-800 whitespace-nowrap">
                            {formatCOP(c.valor)}
                          </td>
                          <td className="px-4 md:px-5 py-2.5 text-right">
                            <span
                              className="inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ color: c.color, backgroundColor: c.color + '18' }}
                            >
                              {pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 md:px-5 py-2.5 hidden md:table-cell">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-24">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, backgroundColor: c.color }}
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr className="font-bold text-sm">
                      <td className="px-4 md:px-5 py-3" />
                      <td className="px-4 md:px-5 py-3 text-gray-600">Total egresos</td>
                      <td className="px-4 md:px-5 py-3 text-right text-red-600 whitespace-nowrap">{formatCOP(totalEgresos)}</td>
                      <td className="px-4 md:px-5 py-3 text-right">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">100%</span>
                      </td>
                      <td className="hidden md:table-cell" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Tabla detalle por día ── */}
          {datosDiarios.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 md:p-5 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800 text-sm">Detalle por día</h2>
                <p className="text-xs text-gray-400 mt-0.5">{datosDiarios.length} día{datosDiarios.length !== 1 ? 's' : ''} con movimientos</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr className="text-xs text-gray-400 font-medium">
                      <th className="text-left px-4 md:px-5 py-3">Fecha</th>
                      <th className="text-right px-4 md:px-5 py-3">Ingresos</th>
                      <th className="text-right px-4 md:px-5 py-3">Egresos</th>
                      <th className="text-right px-4 md:px-5 py-3">Balance del día</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...datosDiarios].reverse().map((d, i) => {
                      const bal = d.ingresos - d.egresos
                      return (
                        <tr key={d.fecha} className={`border-t border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                          <td className="px-4 md:px-5 py-2.5 text-gray-700 font-medium whitespace-nowrap">{d.label}</td>
                          <td className="px-4 md:px-5 py-2.5 text-right text-emerald-600 font-medium">
                            {d.ingresos > 0 ? formatCOP(d.ingresos) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 md:px-5 py-2.5 text-right text-red-500 font-medium">
                            {d.egresos > 0 ? formatCOP(d.egresos) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className={`px-4 md:px-5 py-2.5 text-right font-semibold ${bal >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                            {formatCOP(bal)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr className="text-sm font-bold">
                      <td className="px-4 md:px-5 py-3 text-gray-600">Total</td>
                      <td className="px-4 md:px-5 py-3 text-right text-emerald-700">{formatCOP(totalIngresos)}</td>
                      <td className="px-4 md:px-5 py-3 text-right text-red-600">{formatCOP(totalEgresos)}</td>
                      <td className={`px-4 md:px-5 py-3 text-right ${(totalIngresos-totalEgresos)>=0 ? 'text-blue-700' : 'text-orange-600'}`}>
                        {formatCOP(totalIngresos - totalEgresos)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Tendencia del balance ── */}
          <div className="bg-white rounded-2xl p-4 md:p-5 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 text-sm mb-1">Tendencia del balance</h2>
            <p className="text-xs text-gray-400 mb-3">Últimos 6 meses</p>
            <LineaBalance datos={datosMeses} />
          </div>

          {/* Saldos — solo mobile (desktop lo muestra en sidebar) */}
          {cuentas.length > 0 && (
            <div className="md:hidden bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
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
      </div>
    </div>
  )
}
