import { createClient } from '@/lib/supabase/server'
import { MovimientosClient } from '@/components/movimientos/movimientos-client'
import { Suspense } from 'react'

async function MovimientosContent() {
  const supabase = await createClient()

  const now = new Date()
  const inicio = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const fin = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const [{ data: transacciones }, { data: categorias }, { data: cuentas }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, categories(*, macro_categories(*)), accounts(*)')
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: false }),
    supabase.from('categories').select('*, macro_categories(*)').order('nombre'),
    supabase.from('accounts').select('*').order('nombre'),
  ])

  return (
    <MovimientosClient
      transacciones={transacciones ?? []}
      categorias={categorias ?? []}
      cuentas={cuentas ?? []}
    />
  )
}

export default function MovimientosPage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <Suspense fallback={<p className="text-center text-gray-400 mt-20">Cargando...</p>}>
        <MovimientosContent />
      </Suspense>
    </div>
  )
}
