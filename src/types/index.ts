export type TipoCuenta = 'efectivo' | 'debito' | 'credito' | 'ahorros' | 'otro'
export type GrupoCategoria = 'necesidad' | 'gusto' | 'otro'
export type TipoMovimiento = 'ingreso' | 'egreso'
export type TipoTasa = 'EA' | 'EM' | 'NM'
export type EstadoDeuda = 'activa' | 'pagada'
export type TipoAbono = 'capital' | 'interes' | 'mixto'

export interface Cuenta {
  id: string
  user_id: string
  nombre: string
  tipo: TipoCuenta
  banco: string | null
  ultimos_digitos: string | null
  cupo: number | null
  saldo_actual: number | null
  created_at: string
  updated_at: string
}

export interface Categoria {
  id: string
  user_id: string
  nombre: string
  tipo: TipoMovimiento
  color: string
  icono: string | null
  grupo: GrupoCategoria
  es_predeterminada: boolean
  created_at: string
  updated_at: string
}

export interface Transaccion {
  id: string
  user_id: string
  tipo: TipoMovimiento
  monto: number
  fecha: string
  category_id: string | null
  account_id: string | null
  establecimiento: string | null
  rubro: string | null
  detalle: string | null
  created_at: string
  updated_at: string
  categories?: Categoria
  accounts?: Cuenta
}

export interface Deuda {
  id: string
  user_id: string
  nombre: string
  monto_original: number
  saldo_actual: number
  tasa_interes: number
  tasa_tipo: TipoTasa
  fecha_inicio: string
  cuota_estimada: number | null
  plazo_meses: number | null
  estado: EstadoDeuda
  created_at: string
  updated_at: string
}

export interface AbonoDeuda {
  id: string
  user_id: string
  debt_id: string
  monto: number
  fecha: string
  tipo: TipoAbono
  nota: string | null
  created_at: string
  updated_at: string
}
