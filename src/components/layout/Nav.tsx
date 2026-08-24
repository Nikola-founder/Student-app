// src/components/layout/Nav.tsx
'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { CalendarDays, NotebookPen, Wallet, Users, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const LINKS = [
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/journal', label: 'Journal', icon: NotebookPen },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/contacts', label: 'Contacts', icon: Users },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (pathname === '/login') return null

  return (
    <>
      {/* Desktop / tablet: top nav */}
      <nav className="hidden border-b border-gray-100 bg-white/80 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-indigo-600">Boarding Life</span>
          <div className="flex items-center gap-1">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  pathname.startsWith(href)
                    ? 'bg-indigo-50 text-indigo-600'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" /> {label}
              </Link>
            ))}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </nav>

      {/* Mobile: bottom tab bar — this is the primary nav on phones */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur sm:hidden">
        <div className="flex items-center justify-around py-2">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium ${
                pathname.startsWith(href) ? 'text-indigo-600' : 'text-gray-400'
              }`}
            >
              <Icon className="h-5 w-5" /> {label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  )
}
