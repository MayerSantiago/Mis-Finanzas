import { createClient } from '@/lib/supabase/server'
import { CategoriasClient } from '@/components/categorias/categorias-client'

export default async function CategoriasPage() {
  const supabase = await createClient()

  const [{ data: categorias }, { data: macroCategorias }] = await Promise.all([
    supabase
      .from('categories')
      .select('*, macro_categories(*)')
      .order('tipo', { ascending: true })
      .order('nombre', { ascending: true }),
    supabase
      .from('macro_categories')
      .select('*')
      .order('nombre', { ascending: true }),
  ])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <CategoriasClient
        categorias={categorias ?? []}
        macroCategorias={macroCategorias ?? []}
      />
    </div>
  )
}
