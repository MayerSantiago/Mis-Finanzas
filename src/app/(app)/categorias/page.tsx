import { createClient } from '@/lib/supabase/server'
import { CategoriasClient } from '@/components/categorias/categorias-client'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: categorias } = await supabase
    .from('categories')
    .select('*')
    .order('tipo', { ascending: true })
    .order('nombre', { ascending: true })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <CategoriasClient categorias={categorias ?? []} />
    </div>
  )
}
