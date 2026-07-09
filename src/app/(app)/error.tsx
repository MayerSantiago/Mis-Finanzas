'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <p className="text-4xl mb-4">⚠️</p>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Algo salió mal</h2>
      <p className="text-sm text-gray-500 mb-6 max-w-xs">
        Ocurrió un error inesperado. Puedes intentar recargar la sección.
      </p>
      <Button onClick={reset} className="bg-emerald-600 hover:bg-emerald-700">
        Reintentar
      </Button>
    </div>
  )
}
