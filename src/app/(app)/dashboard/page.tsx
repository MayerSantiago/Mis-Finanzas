import { createClient } from '@/lib/supabase/server'
import { formatCOP, TIPO_CUENTA_ICON } from '@/lib/format'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasMensuales } from '@/components/dashboard/barras-mensuales'

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const now       = new Date()
  const year      = now.getFullYear()
  const mesActual = now.getMonth()        // 0-indexed
  const inicioMes = `${year}-${String(mesActual + 1).padStart(2, '0')}-01`
  const finMes    = new Date(year, mesActual + 1, 0).toISOString().split('T')[0]
  const inicioAño = `${year}-01-01`
  const hoy       = now.toISOString().split('T')[0]

  const [{ data: profile }, { data: txMes }, { data: txAño }, { data: cuentas }] = await Promise.all([
    supabase.from('profiles').select('nombre').eq('id', user!.id).single(),
    supabase.from('transactions')
      .select('tipo, monto, categories(nombre, color)')
      .gte('fecha', inicioMes).lte('fecha', finMes),
    supabase.from('transactions')
      .select('tipo, monto, fecha')
      .gte('fecha', inicioAño).lte('fecha', hoy),
    supabase.from('accounts').select('nombre, tipo, saldo_actual').order('saldo_actual', { ascending: false }),
  ])

  // ── Totales del mes ──
  const ingMes = (txMes ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egrMes = (txMes ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)
  const balMes = ingMes - egrMes

  // ── Totales del año ──
  const ingAño = (txAño ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const egrAño = (txAño ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)
  const balAño = ingAño - egrAño

  // ── Dona egresos por categoría (mes) ──
  const mapCat: Record<string, { valor: number; color: string }> = {}
  for (const t of (txMes ?? [])) {
    if (t.tipo !== 'egreso') continue
    const cat    = (t.categories as unknown) as { nombre: string; color: string } | null
    const nombre = cat?.nombre ?? 'Sin categoría'
    const color  = cat?.color  ?? '#6b7280'
    mapCat[nombre] = { valor: (mapCat[nombre]?.valor ?? 0) + t.monto, color }
  }
  const datosDona = Object.entries(mapCat)
    .map(([nombre, { valor, color }]) => ({ nombre, valor, color }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  // ── Chart mensual: ingresos vs egresos por mes del año ──
  const mesMap: Record<number, { ingresos: number; egresos: number }> = {}
  for (let m = 0; m <= mesActual; m++) mesMap[m] = { ingresos: 0, egresos: 0 }
  for (const t of (txAño ?? [])) {
    const m = parseInt(t.fecha.split('-')[1]) - 1
    if (mesMap[m] === undefined) continue
    if (t.tipo === 'ingreso') mesMap[m].ingresos += t.monto
    else                       mesMap[m].egresos  += t.monto
  }
  const datosBarra = Object.entries(mesMap)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([m, v]) => ({ mes: MESES_ES[Number(m)], ...v }))

  const nombreMes = now.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Saludo */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Hola, {profile?.nombre || 'bienvenido'} 👋</h1>
        <p className="text-sm text-gray-500 capitalize">Resumen de {nombreMes}</p>
      </div>

      {/* ── Este mes ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 capitalize">
          {now.toLocaleDateString('es-CO', { month: 'long' })}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-emerald-50 rounded-2xl p-3">
            <TrendingUp className="h-4 w-4 text-emerald-600 mb-1" />
            <p className="text-[10px] text-emerald-700">Ingresos</p>
            <p className="font-bold text-emerald-700 text-sm leading-tight">{formatCOP(ingMes)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-3">
            <TrendingDown className="h-4 w-4 text-red-500 mb-1" />
            <p className="text-[10px] text-red-600">Egresos</p>
            <p className="font-bold text-red-600 text-sm leading-tight">{formatCOP(egrMes)}</p>
          </div>
          <div className={`rounded-2xl p-3 ${balMes >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <Wallet className={`h-4 w-4 mb-1 ${balMes >= 0 ? 'text-blue-600' : 'text-orange-500'}`} />
            <p className={`text-[10px] ${balMes >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>Balance</p>
            <p className={`font-bold text-sm leading-tight ${balMes >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
              {formatCOP(balMes)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Todo el año ── */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Año {year}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
            <TrendingUp className="h-4 w-4 text-emerald-500 mb-1" />
            <p className="text-[10px] text-gray-400">Ingresos</p>
            <p className="font-bold text-emerald-600 text-sm leading-tight">{formatCOP(ingAño)}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
            <TrendingDown className="h-4 w-4 text-red-400 mb-1" />
            <p className="text-[10px] text-gray-400">Egresos</p>
            <p className="font-bold text-red-500 text-sm leading-tight">{formatCOP(egrAño)}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm">
            <Wallet className={`h-4 w-4 mb-1 ${balAño >= 0 ? 'text-blue-500' : 'text-orange-400'}`} />
            <p className="text-[10px] text-gray-400">Balance</p>
            <p className={`font-bold text-sm leading-tight ${balAño >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
              {formatCOP(balAño)}
            </p>
          </div>
        </div>
      </div>

      {/* Saldos por cuenta */}
      {(cuentas ?? []).length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Saldo por cuenta</h2>
          <div className="space-y-2">
            {(cuentas ?? []).map(c => (
              <div key={c.nombre} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{TIPO_CUENTA_ICON[c.tipo] ?? '🪙'}</span>
                  <span className="text-sm text-gray-700">{c.nombre}</span>
                </div>
                <span className={`text-sm font-semibold ${(c.saldo_actual ?? 0) >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                  {formatCOP(c.saldo_actual)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dona egresos por categoría del mes */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Egresos por categoría</h2>
        <p className="text-xs text-gray-400 mb-2 capitalize">{nombreMes}</p>
        <DonutCategorias datos={datosDona} />
      </div>

      {/* Barras ingresos vs egresos — todos los meses del año */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Evolución mensual</h2>
        <p className="text-xs text-gray-400 mb-3">Año {year}</p>
        <BarrasMensuales datos={datosBarra} />
      </div>
    </div>
  )
}
