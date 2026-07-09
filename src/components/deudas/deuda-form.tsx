'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { tasaMensualEfectiva, cuotaMensual } from '@/lib/amortizacion'
import { formatCOP } from '@/lib/format'
import type { Deuda, TipoTasa } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  nombre:        z.string().min(1, 'El nombre es requerido'),
  monto_original: z.string().min(1, 'Ingresa el monto original'),
  saldo_actual:  z.string().min(1, 'Ingresa el saldo actual'),
  tasa_interes:  z.string().min(1, 'Ingresa la tasa'),
  tasa_tipo:     z.enum(['EA', 'EM', 'NM']),
  fecha_inicio:  z.string().min(1, 'Ingresa la fecha'),
  plazo_meses:   z.string().optional(),
  cuota_estimada: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  onSaved: (d: Deuda) => void
  editando?: Deuda | null
}

export function DeudaForm({ open, onClose, onSaved, editando }: Props) {
  const [loading, setLoading] = useState(false)
  const [cuotaCalculada, setCuotaCalculada] = useState<number | null>(null)
  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tasa_tipo: 'EA', fecha_inicio: today },
    })

  const [saldoW, tasaW, tasaTipoW, plazoW] = watch(['saldo_actual', 'tasa_interes', 'tasa_tipo', 'plazo_meses'])

  // Calcular cuota estimada en tiempo real
  useEffect(() => {
    const saldo = parseFloat(saldoW)
    const tasa  = parseFloat(tasaW)
    const plazo = parseInt(plazoW ?? '')
    if (saldo > 0 && tasa > 0 && plazo > 0) {
      const im = tasaMensualEfectiva(tasa, tasaTipoW as TipoTasa)
      setCuotaCalculada(cuotaMensual(saldo, im, plazo))
    } else {
      setCuotaCalculada(null)
    }
  }, [saldoW, tasaW, tasaTipoW, plazoW])

  useEffect(() => {
    if (open) {
      if (editando) {
        reset({
          nombre: editando.nombre,
          monto_original: editando.monto_original.toString(),
          saldo_actual: editando.saldo_actual.toString(),
          tasa_interes: editando.tasa_interes.toString(),
          tasa_tipo: editando.tasa_tipo,
          fecha_inicio: editando.fecha_inicio,
          plazo_meses: editando.plazo_meses?.toString() ?? '',
          cuota_estimada: editando.cuota_estimada?.toString() ?? '',
        })
      } else {
        reset({ tasa_tipo: 'EA', fecha_inicio: today, nombre: '', monto_original: '', saldo_actual: '', tasa_interes: '', plazo_meses: '', cuota_estimada: '' })
      }
    }
  }, [open, editando])

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const im = tasaMensualEfectiva(parseFloat(data.tasa_interes), data.tasa_tipo as TipoTasa)
    const plazo = data.plazo_meses ? parseInt(data.plazo_meses) : null
    const saldo = parseFloat(data.saldo_actual)
    const cuota = data.cuota_estimada && parseFloat(data.cuota_estimada) > 0
      ? parseFloat(data.cuota_estimada)
      : (plazo ? cuotaMensual(saldo, im, plazo) : null)

    const payload = {
      user_id: user.id,
      nombre: data.nombre,
      monto_original: parseFloat(data.monto_original),
      saldo_actual: saldo,
      tasa_interes: parseFloat(data.tasa_interes),
      tasa_tipo: data.tasa_tipo,
      fecha_inicio: data.fecha_inicio,
      plazo_meses: plazo,
      cuota_estimada: cuota ? Math.round(cuota) : null,
      estado: 'activa' as const,
    }

    if (editando) {
      const { data: updated, error } = await supabase.from('debts').update(payload).eq('id', editando.id).select().single()
      if (!error && updated) onSaved(updated as Deuda)
    } else {
      const { data: created, error } = await supabase.from('debts').insert(payload).select().single()
      if (!error && created) onSaved(created as Deuda)
    }
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar deuda' : 'Nueva deuda'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input placeholder="Ej: Crédito Bancolombia" {...register('nombre')} />
            {errors.nombre && <p className="text-xs text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto original *</Label>
              <Input type="number" placeholder="0" {...register('monto_original')} />
              {errors.monto_original && <p className="text-xs text-red-500">{errors.monto_original.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Saldo actual *</Label>
              <Input type="number" placeholder="0" {...register('saldo_actual')} />
              {errors.saldo_actual && <p className="text-xs text-red-500">{errors.saldo_actual.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tasa de interés *</Label>
              <Input type="number" step="0.01" placeholder="Ej: 18.5" {...register('tasa_interes')} />
              {errors.tasa_interes && <p className="text-xs text-red-500">{errors.tasa_interes.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={watch('tasa_tipo')} onValueChange={v => setValue('tasa_tipo', v as TipoTasa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EA">EA — Ef. Anual</SelectItem>
                  <SelectItem value="EM">EM — Ef. Mensual</SelectItem>
                  <SelectItem value="NM">NM — Nom. Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha inicio *</Label>
              <Input type="date" {...register('fecha_inicio')} />
            </div>
            <div className="space-y-1.5">
              <Label>Plazo (meses)</Label>
              <Input type="number" placeholder="Ej: 36" {...register('plazo_meses')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cuota mensual estimada</Label>
            <Input type="number" placeholder={cuotaCalculada ? `Auto: ${formatCOP(cuotaCalculada)}` : '0'} {...register('cuota_estimada')} />
            {cuotaCalculada && (
              <p className="text-xs text-emerald-600">
                Cuota calculada: <strong>{formatCOP(cuotaCalculada)}</strong>/mes
              </p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : editando ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
