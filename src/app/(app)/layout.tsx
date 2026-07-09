import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/nav/sidebar'
import { BottomNav } from '@/components/nav/bottom-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Contenido principal — desplazado por el sidebar en desktop */}
      <main className="md:ml-56 pb-20 md:pb-0">
        {children}
      </main>

      <BottomNav />
    </div>
  )
}
