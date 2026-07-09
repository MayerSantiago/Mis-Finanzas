'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { COLORES_CATEGORIA } from '@/lib/format'
import type { Categoria, TipoMovimiento, GrupoCategoria } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

const GRUPOS: { value: GrupoCategoria; label: string; emoji: string; desc: string }[] = [
  { value: 'necesidad', label: 'Necesidad',  emoji: '🏠', desc: 'Gastos esenciales e indispensables' },
  { value: 'gusto',     label: 'Gusto',      emoji: '🎉', desc: 'Gastos opcionales o de estilo de vida' },
  { value: 'otro',      label: 'Otro',       emoji: '📦', desc: 'Sin clasificar' },
]

const categoriaSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  tipo:   z.enum(['ingreso', 'egreso']),
  grupo:  z.enum(['necesidad', 'gusto', 'otro']),
  color:  z.string().min(1),
  icono:  z.string().optional(),
})

type CategoriaForm = z.infer<typeof categoriaSchema>

interface Props { categorias: Categoria[] }

export function CategoriasClient({ categorias: initial }: Props) {
  const router = useRouter()
  const [categorias, setCategorias] = useState(initial)
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [loading, setLoading] = useState(false)
  const [tabActivo, setTabActivo] = useState<TipoMovimiento>('egreso')

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<CategoriaForm>({ resolver: zodResolver(categoriaSchema), defaultValues: { tipo: 'egreso', grupo: 'necesidad', color: '#6366f1' } })

  const colorWatch = watch('color')
  const tipoWatch  = watch('tipo')
  const grupoWatch = watch('grupo')

  const egresos  = categorias.filter(c => c.tipo === 'egreso')
  const ingresos = categorias.filter(c => c.tipo === 'ingreso')

  function abrirCrear(tipo: TipoMovimiento) {
    setEditando(null)
    reset({ tipo, grupo: 'necesidad', color: '#6366f1', nombre: '', icono: '' })
    setOpen(true)
  }

  function abrirEditar(c: Categoria) {
    setEditando(c)
    reset({ nombre: c.nombre, tipo: c.tipo, grupo: c.grupo ?? 'otro', color: c.color, icono: c.icono ?? '' })
    setOpen(true)
  }

  async function onSubmit(data: CategoriaForm) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const payload = { user_id: user.id, nombre: data.nombre, tipo: data.tipo, grupo: data.grupo, color: data.color, icono: data.icono || null }

    if (editando) {
      const { data: updated, error } = await supabase.from('categories').update(payload).eq('id', editando.id).select().single()
      if (!error && updated) setCategorias(prev => prev.map(c => c.id === editando.id ? updated as Categoria : c))
    } else {
      const { data: created, error } = await supabase.from('categories').insert(payload).select().single()
      if (!error && created) setCategorias(prev => [...prev, created as Categoria])
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function confirmarEliminar() {
    if (!deleteId) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', deleteId)
    if (!error) setCategorias(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    setLoading(false)
    router.refresh()
  }

  function CategoriaGrid({ lista, tipo }: { lista: Categoria[], tipo: TipoMovimiento }) {
    const porGrupo = GRUPOS.map(g => ({
      ...g,
      items: lista.filter(c => (c.grupo ?? 'otro') === g.value),
    })).filter(g => g.items.length > 0)

    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => abrirCrear(tipo)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
        </div>

        {lista.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Sin categorías. Agrega una con el botón "Nueva".</p>
        ) : (
          porGrupo.map(({ value, label, emoji, items }) => (
            <div key={value}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{emoji}</span>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}s</h3>
                <span className="text-xs text-gray-400">({items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map(c => (
                  <div key={c.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                    <span
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                      style={{ backgroundColor: c.color + '22', color: c.color }}
                    >
                      {c.icono || '●'}
                    </span>
                    <span className="flex-1 text-sm font-medium text-gray-800 truncate">{c.nombre}</span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => abrirEditar(c)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!c.es_predeterminada && (
                        <button onClick={() => setDeleteId(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Categorías</h1>
        <p className="text-sm text-gray-500">{categorias.length} categorías en total</p>
      </div>

      <Tabs value={tabActivo} onValueChange={v => setTabActivo(v as TipoMovimiento)}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="egreso"  className="flex-1">Egresos ({egresos.length})</TabsTrigger>
          <TabsTrigger value="ingreso" className="flex-1">Ingresos ({ingresos.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="egreso">
          <CategoriaGrid lista={egresos} tipo="egreso" />
        </TabsContent>
        <TabsContent value="ingreso">
          <CategoriaGrid lista={ingresos} tipo="ingreso" />
        </TabsContent>
      </Tabs>

      {/* Modal crear / editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Supermercado" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={tipoWatch} onValueChange={v => setValue('tipo', v as TipoMovimiento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="egreso">Egreso</SelectItem>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Grupo *</Label>
                <Select value={grupoWatch} onValueChange={v => setValue('grupo', v as GrupoCategoria)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.emoji} {g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Ícono (emoji)</Label>
              <Input placeholder="Ej: 🛒" {...register('icono')} />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORES_CATEGORIA.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color)}
                    className={`w-7 h-7 rounded-full transition-transform ${colorWatch === color ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación eliminar */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>Los movimientos asociados quedarán sin categoría. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminar} className="bg-red-600 hover:bg-red-700">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
