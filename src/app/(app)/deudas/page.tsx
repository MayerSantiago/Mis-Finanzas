import { createClient } from '@/lib/supabase/server'
import type { Deuda } from '@/types'
import { DeudasClient } from '@/components/deudas/deudas-client'

export default async function DeudasPage() {
  const supabase = await createClient()
  const { data: deudas } = await supabase
    .from('debts')
    .select('*')
    .order('created_at', { ascending: false })

  return <DeudasClient deudas={(deudas ?? []) as Deuda[]} />
}
