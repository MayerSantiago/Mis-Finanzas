import type { TipoTasa } from '@/types'

/** Convierte tasa anual/mensual al equivalente mensual efectivo */
export function tasaMensualEfectiva(tasa: number, tipo: TipoTasa): number {
  const r = tasa / 100
  switch (tipo) {
    case 'EA': return Math.pow(1 + r, 1 / 12) - 1   // (1+EA)^(1/12) - 1
    case 'EM': return r                               // ya es mensual efectiva
    case 'NM': return r / 12                          // nominal anual / 12
  }
}

export interface PeriodoAmortizacion {
  periodo: number
  fecha: string
  cuota: number
  interes: number
  capital: number
  saldo: number
}

/**
 * Genera la tabla de amortización francesa (cuota fija) a partir del saldo actual.
 * Si no se conoce el plazo, usa la cuota estimada para calcular cuántos períodos faltan.
 */
export function calcularAmortizacion(params: {
  saldo: number
  tasaMes: number
  plazoMeses?: number | null
  cuotaEstimada?: number | null
  fechaInicio?: string
}): PeriodoAmortizacion[] {
  const { saldo, tasaMes, plazoMeses, cuotaEstimada, fechaInicio } = params

  if (saldo <= 0) return []

  // Determinar cuota mensual
  let cuota: number
  if (cuotaEstimada && cuotaEstimada > 0) {
    cuota = cuotaEstimada
  } else if (plazoMeses && plazoMeses > 0) {
    if (tasaMes === 0) {
      cuota = saldo / plazoMeses
    } else {
      const i = tasaMes
      const n = plazoMeses
      cuota = saldo * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1)
    }
  } else {
    return [] // sin suficiente información
  }

  const periodos: PeriodoAmortizacion[] = []
  let balance = saldo
  const base = fechaInicio ? new Date(fechaInicio + 'T00:00:00') : new Date()
  const MAX_PERIODOS = 600 // tope de seguridad (50 años)

  for (let i = 1; i <= MAX_PERIODOS && balance > 0.5; i++) {
    const fecha = new Date(base)
    fecha.setMonth(base.getMonth() + i)

    const interes = balance * tasaMes
    const capitalPeriodo = Math.min(cuota - interes, balance)
    const nuevoSaldo = Math.max(0, balance - capitalPeriodo)

    periodos.push({
      periodo: i,
      fecha: fecha.toISOString().split('T')[0],
      cuota:   redondear(cuota),
      interes: redondear(interes),
      capital: redondear(capitalPeriodo),
      saldo:   redondear(nuevoSaldo),
    })

    balance = nuevoSaldo
  }

  return periodos
}

function redondear(n: number) { return Math.round(n * 100) / 100 }

/** Calcula la cuota mensual dado capital, tasa mensual y plazo */
export function cuotaMensual(capital: number, tasaMes: number, plazoMeses: number): number {
  if (tasaMes === 0) return capital / plazoMeses
  const i = tasaMes
  const n = plazoMeses
  return capital * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1)
}

/** Fecha estimada de pago total (último período de la tabla) */
export function fechaEstimadaPago(periodos: PeriodoAmortizacion[]): string | null {
  if (!periodos.length) return null
  return periodos[periodos.length - 1].fecha
}
