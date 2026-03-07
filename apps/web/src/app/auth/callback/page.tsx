'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-magenta dark:bg-surface-dark">
      <Loader2 size={28} className="animate-spin text-brand-green" />
    </div>
  )
}

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const exchanged = useRef(false)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const token = searchParams.get('token')
    if (!token) {
      router.replace('/')
      return
    }

    fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (res.ok) {
          router.replace('/dashboard')
        } else {
          router.replace('/')
        }
      })
      .catch(() => {
        router.replace('/')
      })
  }, [searchParams, router])

  return <Spinner />
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <CallbackHandler />
    </Suspense>
  )
}
