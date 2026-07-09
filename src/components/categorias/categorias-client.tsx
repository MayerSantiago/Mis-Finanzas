'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { COLORES_CATEGORIA } from '@/lib/format'
import type { Categoria, MacroCategoria, TipoMovimiento, GrupoCategoria } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2, Layers } from 'lucide-react'

const GRUPOS: { value: GrupoCategoria; label: string; emoji: string }[] = [
  { value: 'necesidad', label: 'Necesidad',  emoji: '🏠' },
  { value: 'gusto',     label: 'Gusto',      emoji: '🎉' },
  { value: 'otro',      label: 'Otro',       emoji: '📦' },
]

const categoriaSchema = z.object({
  nombre:            z.string().min(1, 'El nombre es requerido'),
  tipo:              z.enum(['ingreso', 'egreso']),
  grupo:             z.enum(['necesidad', 'gusto', 'otro']),
  color:             z.string().min(1),
  icono:             z.string().optional(),
  macro_category_id: z.string().optional(),
})

const macroSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  color:  z.string().min(1),
  icono:  z.string().optional(),
})

type CategoriaForm  = z.infer<typeof categoriaSchema>
type MacroForm      = z.infer<typeof macroSchema>

interface Props {
  categorias:      Categoria[]
  macroCategorias: MacroCategoria[]
}

export function CategoriasClient({ categorias: initialCats, macroCategorias: initialMacro }: Props) {
  const router = useRouter()

  // ── Estado categorías ──
  const [categorias,   setCategorias]   = useState(initialCats)
  const [catOpen,      setCatOpen]      = useState(false)
  const [catDeleteId,  setCatDeleteId]  = useState<string | null>(null)
  const [editandoCat,  setEditandoCat]  = useState<Categoria | null>(null)
  const [catLoading,   setCatLoading]   = useState(false)
  const [tabActivo,    setTabActivo]    = useState<string>('egreso')

  const [catError,     setCatError]     = useState('')

  // ── Estado macro categorías ──
  const [macros,       setMacros]       = useState(initialMacro)
  const [macroOpen,    setMacroOpen]    = useState(false)
  const [macroDeleteId,setMacroDeleteId]= useState<string | null>(null)
  const [editandoMacro,setEditandoMacro]= useState<MacroCategoria | null>(null)
  const [macroLoading, setMacroLoading] = useState(false)
  const [macroError,   setMacroError]   = useState('')

  // ── Form categoría ──
  const catForm = useForm<CategoriaForm>({
    resolver: zodResolver(categoriaSchema),
    defaultValues: { tipo: 'egreso', grupo: 'necesidad', color: '#6366f1' },
  })
  const colorWatch = catForm.watch('color')
  const tipoWatch  = catForm.watch('tipo')
  const grupoWatch = catForm.watch('grupo')
  const macroWatch = catForm.watch('macro_category_id')

  // ── Form macro categoría ──
  const macroForm = useForm<MacroForm>({
    resolver: zodResolver(macroSchema),
    defaultValues: { color: '#6366f1' },
  })
  const macroColorWatch = macroForm.watch('color')

  // ── CRUD Categorías ──
  function abrirCrearCat(tipo: TipoMovimiento) {
    setEditandoCat(null)
    catForm.reset({ tipo, grupo: 'necesidad', color: '#6366f1', nombre: '', icono: '', macro_category_id: undefined })
    setCatOpen(true)
  }

  function abrirEditarCat(c: Categoria) {
    setEditandoCat(c)
    catForm.reset({
      nombre: c.nombre,
      tipo: c.tipo,
      grupo: c.grupo ?? 'otro',
      color: c.color,
      icono: c.icono ?? '',
      macro_category_id: c.macro_category_id ?? undefined,
    })
    setCatOpen(true)
  }

  async function onSubmitCat(data: CategoriaForm) {
    setCatLoading(true)
    setCatError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCatLoading(false); return }

    const payload = {
      user_id:           user.id,
      nombre:            data.nombre,
      tipo:              data.tipo,
      grupo:             data.grupo,
      color:             data.color,
      icono:             data.icono || null,
      macro_category_id: data.macro_category_id || null,
    }

    if (editandoCat) {
      const { data: updated, error } = await supabase
        .from('categories').update(payload).eq('id', editandoCat.id)
        .select('*, macro_categories(*)').single()
      if (error) { setCatError(error.message); setCatLoading(false); return }
      if (updated) setCategorias(prev => prev.map(c => c.id === editandoCat.id ? updated as Categoria : c))
    } else {
      const { data: created, error } = await supabase
        .from('categories').insert(payload)
        .select('*, macro_categories(*)').single()
      if (error) { setCatError(error.message); setCatLoading(false); return }
      if (created) setCategorias(prev => [...prev, created as Categoria])
    }
    setCatLoading(false)
    setCatOpen(false)
    router.refresh()
  }

  async function confirmarEliminarCat() {
    if (!catDeleteId) return
    setCatLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('categories').delete().eq('id', catDeleteId)
    if (!error) setCategorias(prev => prev.filter(c => c.id !== catDeleteId))
    setCatDeleteId(null)
    setCatLoading(false)
    router.refresh()
  }

  // ── CRUD Macro Categorías ──
  function abrirCrearMacro() {
    setEditandoMacro(null)
    macroForm.reset({ nombre: '', color: '#6366f1', icono: '' })
    setMacroOpen(true)
  }

  function abrirEditarMacro(m: MacroCategoria) {
    setEditandoMacro(m)
    macroForm.reset({ nombre: m.nombre, color: m.color, icono: m.icono ?? '' })
    setMacroOpen(true)
  }

  async function onSubmitMacro(data: MacroForm) {
    setMacroLoading(true)
    setMacroError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMacroLoading(false); return }

    const payload = {
      user_id: user.id,
      nombre:  data.nombre,
      color:   data.color,
      icono:   data.icono || null,
    }

    if (editandoMacro) {
      const { data: updated, error } = await supabase
        .from('macro_categories').update(payload).eq('id', editandoMacro.id).select().single()
      if (error) { setMacroError(error.message); setMacroLoading(false); return }
      if (updated) setMacros(prev => prev.map(m => m.id === editandoMacro.id ? updated as MacroCategoria : m))
    } else {
      const { data: created, error } = await supabase
        .from('macro_categories').insert(payload).select().single()
      if (error) { setMacroError(error.message); setMacroLoading(false); return }
      if (created) setMacros(prev => [...prev, created as MacroCategoria])
    }
    setMacroLoading(false)
    setMacroOpen(false)
    router.refresh()
  }

  async function confirmarEliminarMacro() {
    if (!macroDeleteId) return
    setMacroLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('macro_categories').delete().eq('id', macroDeleteId)
    if (!error) {
      setMacros(prev => prev.filter(m => m.id !== macroDeleteId))
      setCategorias(prev => prev.map(c => c.macro_category_id === macroDeleteId ? { ...c, macro_category_id: null, macro_categories: undefined } : c))
    }
    setMacroDeleteId(null)
    setMacroLoading(false)
    router.refresh()
  }

  // ── Grid de categorías ──
  function CategoriaGrid({ lista, tipo }: { lista: Categoria[], tipo: TipoMovimiento }) {
    // Si hay macro categorías creadas, agrupar por ellas; si no, por grupo
    const usarMacro = macros.length > 0

    type Grupo = { id: string | null; label: string; emoji: string | null; color: string; items: Categoria[] }
    let grupos: Grupo[] = []

    if (usarMacro) {
      macros.forEach(m => {
        const items = lista.filter(c => c.macro_category_id === m.id)
        if (items.length > 0) grupos.push({ id: m.id, label: m.nombre, emoji: m.icono, color: m.color, items })
      })
      const sinMacro = lista.filter(c => !c.macro_category_id || !macros.find(m => m.id === c.macro_category_id))
      if (sinMacro.length > 0) grupos.push({ id: null, label: 'Sin macro categoría', emoji: '📦', color: '#9ca3af', items: sinMacro })
    } else {
      grupos = GRUPOS.map(g => ({
        id: g.value, label: `${g.label}s`, emoji: g.emoji, color: '#6b7280',
        items: lista.filter(c => (c.grupo ?? 'otro') === g.value),
      })).filter(g => g.items.length > 0)
    }

    return (
      <div className="space-y-5">
        <div className="flex justify-end">
          <Button size="sm" onClick={() => abrirCrearCat(tipo)} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
        </div>

        {lista.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-12">Sin categorías. Agrega una con el botón "Nueva".</p>
        ) : (
          grupos.map(g => (
            <div key={g.id ?? 'sin'}>
              <div className="flex items-center gap-2 mb-2">
                {g.emoji && <span className="text-base">{g.emoji}</span>}
                {!g.emoji && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />}
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{g.label}</h3>
                <span className="text-xs text-gray-400">({g.items.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {g.items.map(c => {
                  const macro = macros.find(m => m.id === c.macro_category_id)
                  const grupoMeta = GRUPOS.find(gp => gp.value === (c.grupo ?? 'otro'))
                  return (
                    <div key={c.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                        style={{ backgroundColor: c.color + '22', color: c.color }}
                      >
                        {c.icono || '●'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{c.nombre}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {grupoMeta && (
                            <span className="text-[10px] text-gray-400">{grupoMeta.emoji} {grupoMeta.label}</span>
                          )}
                          {macro && !usarMacro && (
                            <span
                              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border"
                              style={{ color: macro.color, backgroundColor: macro.color + '15', borderColor: macro.color + '40' }}
                            >
                              {macro.icono} {macro.nombre}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => abrirEditarCat(c)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {!c.es_predeterminada && (
                          <button onClick={() => setCatDeleteId(c.id)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  const egresos  = categorias.filter(c => c.tipo === 'egreso')
  const ingresos = categorias.filter(c => c.tipo === 'ingreso')

  return (
    <>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Categorías</h1>
        <p className="text-sm text-gray-500">{categorias.length} categorías · {macros.length} macro categorías</p>
      </div>

      <Tabs value={tabActivo} onValueChange={setTabActivo}>
        <TabsList className="w-full mb-4">
          <TabsTrigger value="egreso"  className="flex-1">Egresos ({egresos.length})</TabsTrigger>
          <TabsTrigger value="ingreso" className="flex-1">Ingresos ({ingresos.length})</TabsTrigger>
          <TabsTrigger value="macro"   className="flex-1 gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Macro ({macros.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="egreso">
          <CategoriaGrid lista={egresos} tipo="egreso" />
        </TabsContent>
        <TabsContent value="ingreso">
          <CategoriaGrid lista={ingresos} tipo="ingreso" />
        </TabsContent>

        {/* ── Tab Macro Categorías ── */}
        <TabsContent value="macro">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={abrirCrearMacro} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nueva macro
              </Button>
            </div>

            {macros.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium text-sm">Sin macro categorías</p>
                <p className="text-xs mt-1">Crea grupos como "Alimentos", "Deportes", "Ocio" para organizar tus categorías.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {macros.map(m => {
                  const catCount = categorias.filter(c => c.macro_category_id === m.id).length
                  return (
                    <div key={m.id} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                          style={{ backgroundColor: m.color + '22', color: m.color }}
                        >
                          {m.icono || <Layers className="h-5 w-5" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800">{m.nombre}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {catCount} categoría{catCount !== 1 ? 's' : ''} asignada{catCount !== 1 ? 's' : ''}
                          </p>
                          {catCount > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {categorias.filter(c => c.macro_category_id === m.id).slice(0, 5).map(c => (
                                <span
                                  key={c.id}
                                  className="text-[10px] px-1.5 py-0.5 rounded-full"
                                  style={{ backgroundColor: c.color + '22', color: c.color }}
                                >
                                  {c.icono} {c.nombre}
                                </span>
                              ))}
                              {catCount > 5 && <span className="text-[10px] text-gray-400">+{catCount - 5}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => abrirEditarMacro(m)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setMacroDeleteId(m.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Modal crear / editar categoría ── */}
      <Dialog open={catOpen} onOpenChange={v => { setCatOpen(v); if (!v) setCatError('') }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoCat ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={catForm.handleSubmit(onSubmitCat)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Supermercado" {...catForm.register('nombre')} />
              {catForm.formState.errors.nombre && <p className="text-xs text-red-500">{catForm.formState.errors.nombre.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select value={tipoWatch} onValueChange={v => catForm.setValue('tipo', v as TipoMovimiento)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="egreso">Egreso</SelectItem>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Grupo *</Label>
                <Select value={grupoWatch} onValueChange={v => catForm.setValue('grupo', v as GrupoCategoria)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRUPOS.map(g => (
                      <SelectItem key={g.value} value={g.value}>{g.emoji} {g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Macro categoría */}
            {macros.length > 0 && (
              <div className="space-y-1.5">
                <Label>Macro categoría</Label>
                <Select
                  value={macroWatch ?? ''}
                  onValueChange={v => catForm.setValue('macro_category_id', v || undefined)}
                >
                  <SelectTrigger><SelectValue placeholder="Sin macro categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sin macro categoría</SelectItem>
                    {macros.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.icono} {m.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Ícono (emoji)</Label>
              <Input placeholder="Ej: 🛒" {...catForm.register('icono')} />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORES_CATEGORIA.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => catForm.setValue('color', color)}
                    className={`w-7 h-7 rounded-full transition-transform ${colorWatch === color ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {catError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3">{catError}</div>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCatOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={catLoading}>
                {catLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : editandoCat ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal crear / editar macro categoría ── */}
      <Dialog open={macroOpen} onOpenChange={v => { setMacroOpen(v); if (!v) setMacroError('') }}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editandoMacro ? 'Editar macro categoría' : 'Nueva macro categoría'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={macroForm.handleSubmit(onSubmitMacro)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Alimentos, Deportes, Ocio…" {...macroForm.register('nombre')} />
              {macroForm.formState.errors.nombre && <p className="text-xs text-red-500">{macroForm.formState.errors.nombre.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Ícono (emoji)</Label>
              <Input placeholder="Ej: 🍔" {...macroForm.register('icono')} />
            </div>

            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLORES_CATEGORIA.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => macroForm.setValue('color', color)}
                    className={`w-7 h-7 rounded-full transition-transform ${macroColorWatch === color ? 'ring-2 ring-offset-2 ring-gray-800 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {macroError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg p-3">{macroError}</div>
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setMacroOpen(false)}>Cancelar</Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={macroLoading}>
                {macroLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : editandoMacro ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirmar eliminar categoría ── */}
      <AlertDialog open={!!catDeleteId} onOpenChange={() => setCatDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>Los movimientos asociados quedarán sin categoría. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminarCat} className="bg-red-600 hover:bg-red-700">
              {catLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirmar eliminar macro categoría ── */}
      <AlertDialog open={!!macroDeleteId} onOpenChange={() => setMacroDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar macro categoría?</AlertDialogTitle>
            <AlertDialogDescription>Las categorías asignadas a este grupo quedarán sin macro categoría. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarEliminarMacro} className="bg-red-600 hover:bg-red-700">
              {macroLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
