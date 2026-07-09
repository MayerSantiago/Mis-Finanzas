'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import type { AbonoDeuda, TipoAbono } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'

const schema = z.object({
  monto: z.string().min(1, 'Ingresa el monto'),
  fecha: z.string().min(1, 'Ingresa la fecha'),
  tipo:  z.enum(['capital', 'interes', 'mixto']),
  nota:  z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  debtId: string
  onClose: () => void
  onSaved: (abono: AbonoDeuda) => void
}

export function AbonoForm({ open, debtId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<FormData>({
      resolver: zodResolver(schema),
      defaultValues: { tipo: 'mixto', fecha: today },
    })

  async function onSubmit(data: FormData) {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: created, error } = await supabase
      .from('debt_payments')
      .insert({
        user_id: user.id,
        debt_id: debtId,
        monto: parseFloat(data.monto),
        fecha: data.fecha,
        tipo: data.tipo,
        nota: data.nota || null,
      })
      .select()
      .single()

    if (!error && created) {
      onSaved(created as AbonoDeuda)
      reset({ tipo: 'mixto', fecha: today, monto: '', nota: '' })
    }
    setLoading(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Registrar abono</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Monto del abono *</Label>
            <Input type="number" placeholder="0" className="text-lg font-bold h-11" {...register('monto')} />
            {errors.monto && <p className="text-xs text-red-500">{errors.monto.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha *</Label>
              <Input type="date" {...register('fecha')} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={watch('tipo')} onValueChange={v => setValue('tipo', v as TipoAbono)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mixto">Mixto</SelectItem>
                  <SelectItem value="capital">Solo capital</SelectItem>
                  <SelectItem value="interes">Solo interés</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Nota (opcional)</Label>
            <Input placeholder="Ej: Pago mensual" {...register('nota')} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar abono'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
