import { createClient } from '@/lib/supabase/server'
import { CuentasClient } from '@/components/cuentas/cuentas-client'

export default async function CuentasPage() {
  const supabase = await createClient()
  const { data: cuentas } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <CuentasClient cuentas={cuentas ?? []} />
    </div>
  )
}
