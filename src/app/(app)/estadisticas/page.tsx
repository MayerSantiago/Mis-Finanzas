import { createClient } from '@/lib/supabase/server'
import { EstadisticasClient } from '@/components/estadisticas/estadisticas-client'

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
      .select('tipo, monto, fecha, establecimiento, persona_grupo, categories(nombre, color, grupo)')
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
      return { mes: MESES_ES[d.getMonth()], balance: ing - egr }
    })
  )

  return (
    <EstadisticasClient
      txMes={(txMes ?? []).map(t => ({
        tipo: t.tipo,
        monto: t.monto,
        fecha: t.fecha,
        establecimiento: t.establecimiento ?? null,
        persona_grupo: (t.persona_grupo as string | null) ?? null,
        categories: (t.categories as unknown) as { nombre: string; color: string; grupo: string } | null,
      }))}
      datosMeses={datosMeses}
      cuentas={(cuentas ?? []).map(c => ({ nombre: c.nombre, tipo: c.tipo, saldo_actual: c.saldo_actual }))}
    />
  )
}
