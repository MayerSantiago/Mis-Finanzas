'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Loader2, Mail, CheckCircle2 } from 'lucide-react'

const registerSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(data: RegisterForm) {
    setServerError('')
    const supabase = createClient()
    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { nombre: data.nombre },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      const msg =
        error.message && error.message !== '{}' && error.message !== '{}'
          ? error.message
          : 'No se pudo crear la cuenta. El email puede que ya esté registrado.'
      setServerError(msg)
      return
    }

    // Si el proyecto tiene confirmación de email desactivada, la sesión ya existe
    if (result.session) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    // Con confirmación de email activada → mostrar mensaje de éxito
    setSuccess(true)
  }

  if (success) {
    return (
      <Card className="w-full max-w-md shadow-xl text-center">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="bg-emerald-100 p-5 rounded-full">
                <Mail className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-600 rounded-full p-0.5">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">¡Cuenta creada!</CardTitle>
          <CardDescription className="text-base mt-1">
            Revisa tu correo electrónico para confirmar tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left space-y-2">
            <p className="text-sm font-semibold text-emerald-800">¿Qué debes hacer?</p>
            <ol className="text-sm text-emerald-700 space-y-1 list-decimal list-inside">
              <li>Abre tu bandeja de entrada</li>
              <li>Busca un correo de <span className="font-medium">Mis Finanzas</span></li>
              <li>Haz clic en el enlace de confirmación</li>
              <li>Regresa aquí e inicia sesión</li>
            </ol>
          </div>
          <p className="text-xs text-gray-400">
            ¿No ves el correo? Revisa tu carpeta de <span className="font-medium">spam</span> o correo no deseado.
          </p>
          <Link href="/login">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
              Ir a iniciar sesión
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center pb-2">
        <div className="flex justify-center mb-3">
          <div className="bg-emerald-600 p-3 rounded-2xl">
            <TrendingUp className="h-7 w-7 text-white" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Mis Finanzas</CardTitle>
        <CardDescription>Crea tu cuenta gratuita</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" placeholder="Tu nombre" autoComplete="name" {...register('nombre')} />
            {errors.nombre && <p className="text-sm text-red-500">{errors.nombre.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input id="email" type="email" placeholder="tu@email.com" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input id="confirmPassword" type="password" placeholder="Repite tu contraseña" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>}
          </div>

          {serverError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
              {serverError}
            </div>
          )}

          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear cuenta'}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-xs text-gray-400 text-center">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            Te enviaremos un correo para confirmar tu cuenta antes de ingresar.
          </p>
        </form>
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-emerald-600 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
