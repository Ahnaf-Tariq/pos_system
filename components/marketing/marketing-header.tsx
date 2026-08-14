'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/lib/routes'
import { cn } from '@/lib/utils'

export function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24)
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled
          ? 'border-b border-border/40 bg-background'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link
          href={ROUTES.home}
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="text-primary">Auric</span> POS
        </Link>
        <nav className="flex items-center gap-3">
          <Button asChild variant="ghost">
            <Link href={ROUTES.login}>Sign in</Link>
          </Button>
          <Button asChild>
            <Link href={ROUTES.signup}>Start free</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
