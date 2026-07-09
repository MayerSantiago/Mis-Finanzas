'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, TIPO_CUENTA_LABEL, TIPO_CUENTA_ICON } from '@/lib/format'
import type { Cuenta, TipoCuenta } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'

const cuentaSchema = z.object({
  nombre:          z.string().min(1, 'El nombre es requerido'),
  tipo:            z.enum(['efectivo', 'debito', 'credito', 'ahorros', 'otro']),
  banco:           z.string().optional(),
  ultimos_digitos: z.string().max(4, 'Máximo 4 dígitos').optional(),
  cupo:            z.string().optional(),
  saldo_actual:    z.string().optional(),
})

type CuentaForm = z.infer<typeof cuentaSchema>

interface Props { cuentas: Cuenta[] }

export function CuentasClient({ cuentas: initial }: Props) {
  const router = useRouter()
  const [cuentas, setCuentas] = useState(initial)
  const [open, setOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [editando, setEditando] = useState<Cuenta | null>(null)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<CuentaForm>({ resolver: zodResolver(cuentaSchema), defaultValues: { tipo: 'debito', saldo_actual: '0' } })

  const tipoWatch = watch('tipo')

  function abrirCrear() {
    setEditando(null)
    reset({ tipo: 'debito', nombre: '', banco: '', ultimos_digitos: '', cupo: '', saldo_actual: '0' })
    setOpen(true)
  }

  function abrirEditar(c: Cuenta) {
    setEditando(c)
    reset({
      nombre: c.nombre,
      tipo: c.tipo,
      banco: c.banco ?? '',
      ultimos_digitos: c.ultimos_digitos ?? '',
      cupo: c.cupo?.toString() ?? '',
      saldo_actual: c.saldo_actual?.toString() ?? '0',
    })
    setOpen(true)
  }

  async function onSubmit(data: CuentaForm) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const payload = {
      user_id: user.id,
      nombre: data.nombre,
      tipo: data.tipo,
      banco: data.banco || null,
      ultimos_digitos: data.ultimos_digitos || null,
      cupo: data.cupo ? parseFloat(data.cupo) : null,
      saldo_actual: data.saldo_actual ? parseFloat(data.saldo_actual) : 0,
    }

    if (editando) {
      const { data: updated, error } = await supabase
        .from('accounts').update(payload).eq('id', editando.id).select().single()
      if (!error && updated) {
        setCuentas(prev => prev.map(c => c.id === editando.id ? updated : c))
      }
    } else {
      const { data: created, error } = await supabase
        .from('accounts').insert(payload).select().single()
      if (!error && created) {
        setCuentas(prev => [...prev, created])
      }
    }
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  async function confirmarEliminar() {
    if (!deleteId) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('accounts').delete().eq('id', deleteId)
    if (!error) {
      setCuentas(prev => prev.filter(c => c.id !== deleteId))
    }
    setDeleteId(null)
    setLoading(false)
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Cuentas</h1>
          <p className="text-sm text-gray-500">{cuentas.length} cuenta{cuentas.length !== 1 ? 's' : ''} registrada{cuentas.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={abrirCrear} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="h-4 w-4" /> Nueva
        </Button>
      </div>

      {cuentas.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">🏦</p>
          <p className="font-medium">Sin cuentas registradas</p>
          <p className="text-sm mt-1">Agrega tu primera cuenta con el botón "Nueva"</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cuentas.map(c => (
            <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
              <span className="text-2xl">{TIPO_CUENTA_ICON[c.tipo]}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{c.nombre}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {TIPO_CUENTA_LABEL[c.tipo]}
                  </Badge>
                  {c.banco && <span className="text-xs text-gray-400 truncate">{c.banco}</span>}
                  {c.ultimos_digitos && <span className="text-xs text-gray-400">••••{c.ultimos_digitos}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-gray-800">{formatCOP(c.saldo_actual)}</p>
                {c.tipo === 'credito' && c.cupo && (
                  <p className="text-[10px] text-gray-400">Cupo: {formatCOP(c.cupo)}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => abrirEditar(c)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal crear / editar */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Tarjeta Bancolombia" {...register('nombre')} />
              {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={tipoWatch} onValueChange={v => setValue('tipo', v as TipoCuenta)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_CUENTA_LABEL).map(([val, lbl]) => (
                    <SelectItem key={val} value={val}>{lbl}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Banco / Entidad</Label>
              <Input placeholder="Ej: Bancolombia" {...register('banco')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Últimos 4 dígitos</Label>
                <Input placeholder="1234" maxLength={4} {...register('ultimos_digitos')} />
                {errors.ultimos_digitos && <p className="text-xs text-red-500">{errors.ultimos_digitos.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Saldo actual</Label>
                <Input type="number" placeholder="0" {...register('saldo_actual')} />
              </div>
            </div>

            {tipoWatch === 'credito' && (
              <div className="space-y-1.5">
                <Label>Cupo total</Label>
                <Input type="number" placeholder="0" {...register('cupo')} />
              </div>
            )}

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
            <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
            <AlertDialogDescription>
              Los movimientos asociados quedarán sin cuenta asignada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
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
