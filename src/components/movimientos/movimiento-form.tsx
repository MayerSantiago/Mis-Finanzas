'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { Categoria, Cuenta, Transaccion, TipoMovimiento, PersonaGrupo } from '@/types'
import { PERSONA_GRUPOS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  tipo:            z.enum(['ingreso', 'egreso']),
  monto:           z.string().min(1, 'Ingresa el monto'),
  fecha:           z.string().min(1, 'Ingresa la fecha'),
  category_id:     z.string().optional(),
  account_id:      z.string().optional(),
  establecimiento: z.string().optional(),
  persona_grupo:   z.enum(['personal', 'familia', 'amigos', 'novia']).optional(),
  detalle:         z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (t: Transaccion) => void
  categorias: Categoria[]
  cuentas: Cuenta[]
  editando?: Transaccion | null
}

export function MovimientoForm({ open, onClose, onSaved, categorias, cuentas, editando }: Props) {
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tipo: 'egreso', fecha: today },
    })

  const tipoWatch       = watch('tipo')
  const categoryIdWatch = watch('category_id')
  const accountIdWatch  = watch('account_id')
  const personaWatch    = watch('persona_grupo')
  const categoriasFiltradas = categorias.filter(c => c.tipo === tipoWatch)

  useEffect(() => {
    if (open) {
      if (editando) {
        reset({
          tipo: editando.tipo,
          monto: editando.monto.toString(),
          fecha: editando.fecha,
          category_id: editando.category_id ?? undefined,
          account_id: editando.account_id ?? undefined,
          establecimiento: editando.establecimiento ?? '',
          persona_grupo: (editando.persona_grupo ?? undefined) as PersonaGrupo | undefined,
          detalle: editando.detalle ?? '',
        })
      } else {
        reset({ tipo: 'egreso', fecha: today, monto: '', establecimiento: '', detalle: '' })
      }
    }
  }, [open, editando])

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const payload = {
      user_id: user.id,
      tipo: data.tipo,
      monto: parseFloat(data.monto.replace(/\./g, '').replace(',', '.')),
      fecha: data.fecha,
      category_id: data.category_id || null,
      account_id: data.account_id || null,
      establecimiento: data.establecimiento || null,
      persona_grupo: data.persona_grupo || null,
      detalle: data.detalle || null,
    }

    if (editando) {
      const { data: updated, error } = await supabase
        .from('transactions').update(payload).eq('id', editando.id).select(`
          *, categories(*), accounts(*)
        `).single()
      if (!error && updated) onSaved(updated as Transaccion)
    } else {
      const { data: created, error } = await supabase
        .from('transactions').insert(payload).select(`
          *, categories(*), accounts(*)
        `).single()
      if (!error && created) onSaved(created as Transaccion)
    }

    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar movimiento' : 'Nuevo movimiento'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          {/* Toggle ingreso / egreso */}
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['egreso', 'ingreso'] as TipoMovimiento[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setValue('tipo', t); setValue('category_id', undefined) }}
                className={`flex-1 py-2.5 text-sm font-semibold transition-colors
                  ${tipoWatch === t
                    ? t === 'egreso' ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-400 hover:bg-gray-50'
                  }`}
              >
                {t === 'egreso' ? '↓ Egreso' : '↑ Ingreso'}
              </button>
            ))}
          </div>

          {/* Monto */}
          <div className="space-y-1.5">
            <Label>Monto (COP) *</Label>
            <Input
              type="number"
              placeholder="0"
              className="text-xl font-bold h-12"
              {...register('monto')}
            />
            {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
          </div>

          {/* Fecha */}
          <div className="space-y-1.5">
            <Label>Fecha *</Label>
            <Input type="date" {...register('fecha')} />
            {errors.fecha && <p className="text-xs text-red-500">{errors.fecha.message}</p>}
          </div>

          {/* Categoría */}
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select
              value={categoryIdWatch ?? ''}
              onValueChange={(v) => setValue('category_id', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona categoría" />
              </SelectTrigger>
              <SelectContent>
                {categoriasFiltradas.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.icono} {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cuenta */}
          <div className="space-y-1.5">
            <Label>Cuenta / Medio de pago</Label>
            <Select
              value={accountIdWatch ?? ''}
              onValueChange={(v) => setValue('account_id', v || undefined)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Persona / Grupo */}
          <div className="space-y-1.5">
            <Label>Persona / Grupo</Label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONA_GRUPOS.map(g => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setValue('persona_grupo', personaWatch === g.key ? undefined : g.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    personaWatch === g.key
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                  style={personaWatch === g.key ? { backgroundColor: g.color } : {}}
                >
                  <span>{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Establecimiento */}
          <div className="space-y-1.5">
            <Label>Establecimiento / Comercio</Label>
            <Input placeholder="Ej: Éxito, Rappi..." {...register('establecimiento')} />
          </div>

          {/* Detalle */}
          <div className="space-y-1.5">
            <Label>Detalle</Label>
            <Input placeholder="Descripción opcional" {...register('detalle')} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              className={tipoWatch === 'egreso' ? 'bg-red-500 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-700'}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? 'Guardar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
