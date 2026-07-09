'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, List, CreditCard, BarChart2, Wallet, Tag, TrendingUp, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  { href: '/dashboard',    label: 'Inicio',        icon: Home },
  { href: '/movimientos',  label: 'Movimientos',   icon: List },
  { href: '/cuentas',      label: 'Cuentas',       icon: Wallet },
  { href: '/categorias',   label: 'Categorías',    icon: Tag },
  { href: '/deudas',       label: 'Deudas',        icon: CreditCard },
  { href: '/estadisticas', label: 'Estadísticas',  icon: BarChart2 },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="hidden md:flex flex-col w-56 border-r border-gray-200 bg-white min-h-screen fixed top-0 left-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
        <div className="bg-emerald-600 p-1.5 rounded-lg">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <span className="font-bold text-gray-800">Mis Finanzas</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
