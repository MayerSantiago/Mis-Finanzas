export function formatCOP(value: number | null | undefined): string {
  if (value == null) return '$ 0'
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export const TIPO_CUENTA_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  debito:   'Débito',
  credito:  'Crédito',
  ahorros:  'Ahorros',
  otro:     'Otro',
}

export const TIPO_CUENTA_ICON: Record<string, string> = {
  efectivo: '💵',
  debito:   '💳',
  credito:  '💳',
  ahorros:  '🏦',
  otro:     '🪙',
}

export const COLORES_CATEGORIA = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
  '#a855f7', '#ec4899', '#64748b', '#dc2626',
  '#0891b2', '#059669', '#0d9488', '#6b7280',
]
