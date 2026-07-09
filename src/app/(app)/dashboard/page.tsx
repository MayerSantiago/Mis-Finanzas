import { createClient } from '@/lib/supabase/server'
import { formatCOP, TIPO_CUENTA_ICON } from '@/lib/format'
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { DonutCategorias } from '@/components/dashboard/donut-categorias'
import { BarrasMensuales } from '@/components/dashboard/barras-mensuales'

function getMesRango(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  const inicio = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  return { inicio, fin }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: profile }, { data: txMes }, { data: cuentas }] = await Promise.all([
    supabase.from('profiles').select('nombre').eq('id', user!.id).single(),
    supabase.from('transactions').select('tipo, monto, categories(nombre, color)')
      .gte('fecha', getMesRango().inicio).lte('fecha', getMesRango().fin),
    supabase.from('accounts').select('nombre, tipo, saldo_actual').order('saldo_actual', { ascending: false }),
  ])

  // Totales del mes
  const totalIngresos = (txMes ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalEgresos  = (txMes ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0)
  const balance = totalIngresos - totalEgresos

  // Egresos por categoría para la dona
  const mapCat: Record<string, { valor: number; color: string }> = {}
  for (const t of (txMes ?? [])) {
    if (t.tipo !== 'egreso') continue
    const cat = (t.categories as unknown) as { nombre: string; color: string } | null
    const nombre = cat?.nombre ?? 'Sin categoría'
    const color  = cat?.color  ?? '#6b7280'
    mapCat[nombre] = { valor: (mapCat[nombre]?.valor ?? 0) + t.monto, color }
  }
  const datosDona = Object.entries(mapCat)
    .map(([nombre, { valor, color }]) => ({ nombre, valor, color }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 8)

  // Ingresos vs egresos últimos 6 meses
  const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const datosBarra = await Promise.all(
    Array.from({ length: 6 }, (_, i) => i - 5).map(async (offset) => {
      const { inicio, fin } = getMesRango(offset)
      const { data } = await supabase.from('transactions').select('tipo, monto')
        .gte('fecha', inicio).lte('fecha', fin)
      const d = new Date(); d.setMonth(d.getMonth() + offset)
      return {
        mes: MESES_ES[d.getMonth()],
        ingresos: (data ?? []).filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0),
        egresos:  (data ?? []).filter(t => t.tipo === 'egreso').reduce((s, t) => s + t.monto, 0),
      }
    })
  )

  const nombreMes = new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      {/* Saludo */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Hola, {profile?.nombre || 'bienvenido'} 👋</h1>
        <p className="text-sm text-gray-500 capitalize">Resumen de {nombreMes}</p>
      </div>

      {/* Tarjetas resumen */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-2xl p-3">
          <TrendingUp className="h-4 w-4 text-emerald-600 mb-1" />
          <p className="text-[10px] text-emerald-700">Ingresos</p>
          <p className="font-bold text-emerald-700 text-sm leading-tight">{formatCOP(totalIngresos)}</p>
        </div>
        <div className="bg-red-50 rounded-2xl p-3">
          <TrendingDown className="h-4 w-4 text-red-500 mb-1" />
          <p className="text-[10px] text-red-600">Egresos</p>
          <p className="font-bold text-red-600 text-sm leading-tight">{formatCOP(totalEgresos)}</p>
        </div>
        <div className={`rounded-2xl p-3 ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <Wallet className={`h-4 w-4 mb-1 ${balance >= 0 ? 'text-blue-600' : 'text-orange-500'}`} />
          <p className={`text-[10px] ${balance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>Balance</p>
          <p className={`font-bold text-sm leading-tight ${balance >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>{formatCOP(balance)}</p>
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

      {/* Dona egresos por categoría */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Egresos por categoría</h2>
        <p className="text-xs text-gray-400 mb-2 capitalize">{nombreMes}</p>
        <DonutCategorias datos={datosDona} />
      </div>

      {/* Barras ingresos vs egresos */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 text-sm mb-1">Evolución mensual</h2>
        <p className="text-xs text-gray-400 mb-3">Últimos 6 meses</p>
        <BarrasMensuales datos={datosBarra} />
      </div>
    </div>
  )
}
