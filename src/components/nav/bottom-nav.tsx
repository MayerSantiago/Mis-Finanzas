'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Home, List, CreditCard, BarChart2, Plus } from 'lucide-react'

const navItems = [
  { href: '/dashboard',    label: 'Inicio',       icon: Home },
  { href: '/movimientos',  label: 'Movimientos',  icon: List },
  { href: '/deudas',       label: 'Deudas',       icon: CreditCard },
  { href: '/estadisticas', label: 'Estadísticas', icon: BarChart2 },
]

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  function handleFAB() {
    router.push('/movimientos?nuevo=1')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 md:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {navItems.slice(0, 2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 flex-1 py-2">
              <Icon className={`h-5 w-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
              <span className={`text-[10px] ${active ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}

        {/* FAB central */}
        <button
          onClick={handleFAB}
          className="flex flex-col items-center flex-1 -mt-6"
          aria-label="Agregar movimiento"
        >
          <span className="bg-emerald-600 rounded-full p-3.5 shadow-lg shadow-emerald-200">
            <Plus className="h-6 w-6 text-white" />
          </span>
        </button>

        {navItems.slice(2).map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 flex-1 py-2">
              <Icon className={`h-5 w-5 ${active ? 'text-emerald-600' : 'text-gray-400'}`} />
              <span className={`text-[10px] ${active ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
