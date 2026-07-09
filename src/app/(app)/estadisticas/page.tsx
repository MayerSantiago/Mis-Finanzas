import { createClient } from '@/lib/supabase/server'
import { formatCOP } from '@/lib/format'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasHorizontales } from '@/components/estadisticas/barras-horizontales'
import { LineaBalance } from '@/components/estadisticas/linea-balance'

function getMesRango(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  return { inicio, fin }
}

const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default async function EstadisticasPage() {
  const supabase = await createClient()
  const { inicio, fin } = getMesRango()

  const [{ data: txMes }, { data: cuentas }] = await Promise.all([
    supabase.from('transactions')
      .select('tipo, monto, categories(nombre, color, grupo)')
      .gte('fecha', inicio).lte('fecha', fin),
    supabase.from('accounts').select('nombre, tipo, saldo_actual').order('saldo_actual', { ascending: false }),
  ])

  // Últimos 6 meses para línea de balance
  const datosMeses = await Promise.all(
    Array.from({ length: 6 }, (_, i) => i - 5).map(async (offset) => {
      const { inicio: ini, fin: f } = getMesRango(offset)
      const { data } = await supabase.from('transactions').select('tipo, monto')
        .gte('fecha', ini).lte('fecha', f)
      const d = new Date(); d.setMonth(d.getMonth() + offset)
      const ing = (data ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
      const egr = (data ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)
      return { mes: MESES_ES[d.getMonth()], ingresos: ing, egresos: egr, balance: ing - egr }
    })
  )

  // Egresos por categoría
  const mapCat: Record<string, { valor: number; color: string }> = {}
  for (const t of (txMes ?? [])) {
    if (t.tipo !== 'egreso') continue
    const cat = (t.categories as unknown) as { nombre: string; color: string; grupo: string } | null
    const key = cat?.nombre ?? 'Sin categoría'
    mapCat[key] = { valor: (mapCat[key]?.valor ?? 0) + t.monto, color: cat?.color ?? '#6b7280' }
  }
  const datosCat = Object.entries(mapCat)
    .map(([nombre, { valor, color }]) => ({ nombre, valor, color }))
    .sort((a, b) => b.valor - a.valor)

  // Egresos por grupo (necesidad vs gusto)
  const mapGrupo: Record<string, number> = {}
  for (const t of (txMes ?? [])) {
    if (t.tipo !== 'egreso') continue
    const cat = (t.categories as unknown) as { grupo: string } | null
    const grupo = cat?.grupo ?? 'otro'
    mapGrupo[grupo] = (mapGrupo[grupo] ?? 0) + t.monto
  }
  const GRUPO_META = { necesidad: { label: 'Necesidades 🏠', color: '#3b82f6' }, gusto: { label: 'Gustos 🎉', color: '#a855f7' }, otro: { label: 'Otros 📦', color: '#6b7280' } }
  const datosGrupo = Object.entries(mapGrupo)
    .filter(([, v]) => v > 0)
    .map(([k, valor]) => ({ nombre: GRUPO_META[k as keyof typeof GRUPO_META]?.label ?? k, valor, color: GRUPO_META[k as keyof typeof GRUPO_META]?.color ?? '#6b7280' }))

  // Egresos por cuenta
  const mapCuenta: Record<string, { valor: number }> = {}
  for (const t of (txMes ?? [])) {
    if (t.tipo !== 'egreso') continue
  }
  const totalIngresos = (txMes ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalEgresos  = (txMes ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)
  const tasaAhorro = totalIngresos > 0 ? ((totalIngresos - totalEgresos) / totalIngresos * 100) : 0

  const nombreMes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Estadísticas</h1>
        <p className="text-sm text-gray-500 capitalize">{nombreMes}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">Tasa de ahorro</p>
          <p className={`text-2xl font-bold mt-1 ${tasaAhorro >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {tasaAhorro.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">de los ingresos ahorrado</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400">Gasto promedio/día</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">
            {formatCOP(totalEgresos / new Date().getDate())}
          </p>
          <p className="text-xs text-gray-400 mt-1">en lo que va del mes</p>
        </div>
      </div>

      {/* Necesidades vs Gustos */}
      {datosGrupo.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-1">Necesidades vs Gustos</h2>
          <p className="text-xs text-gray-400 mb-4">Distribución de egresos del mes</p>
          <DonutCategorias datos={datosGrupo} />
          <div className="grid grid-cols-2 gap-2 mt-3">
            {datosGrupo.map(g => (
              <div key={g.nombre} className="rounded-xl p-3" style={{ backgroundColor: g.color + '15' }}>
                <p className="text-xs font-medium" style={{ color: g.color }}>{g.nombre}</p>
                <p className="font-bold text-gray-800 text-sm">{formatCOP(g.valor)}</p>
                <p className="text-[10px] text-gray-400">{totalEgresos > 0 ? ((g.valor / totalEgresos) * 100).toFixed(1) : 0}% del total</p>
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

      {/* Línea de balance */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Tendencia del balance</h2>
        <p className="text-xs text-gray-400 mb-3">Últimos 6 meses</p>
        <LineaBalance datos={datosMeses.map(d => ({ mes: d.mes, balance: d.balance }))} />
      </div>

      {/* Saldos cuentas */}
      {(cuentas ?? []).length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 text-sm mb-3">Saldo por cuenta</h2>
          <div className="space-y-3">
            {(cuentas ?? []).map(c => {
              const total = (cuentas ?? []).reduce((s, x) => s + (x.saldo_actual ?? 0), 0)
              const pct = total !== 0 ? Math.abs((c.saldo_actual ?? 0) / total * 100) : 0
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
