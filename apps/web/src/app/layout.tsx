/**
 * layout.tsx
 * Root layout for the entire Next.js app. Sets up the Orbitron font, ThemeProvider,
 * TanStack Query Providers, and all PWA/SEO metadata for the <head>.
 * Phase 8: PWA manifest, theme-color, apple-web-app meta, and viewport lock added.
 */

import type { Metadata, Viewport } from 'next'
import { Orbitron } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Providers } from './providers'
import './globals.css'

// Load Orbitron from Google Fonts and expose it as a CSS variable so Tailwind's
// `font-orbitron` utility class can reference it anywhere in the component tree.
const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-orbitron',
})

/**
 * Static metadata consumed by Next.js to populate <head>.
 * manifest, themeColor, and appleWebApp fields are Phase 8 PWA additions.
 * Icons (icon-192.png, icon-512.png) must be placed in apps/web/public/ before
 * submitting to app stores or enabling install prompts — they are not generated here.
 */
export const metadata: Metadata = {
  title: 'SpottracK',
  description: 'Monitor your Spotify playlists. Never miss a missing track.',
  // Phase 8: PWA manifest link (<link rel="manifest" href="/manifest.json">)
  manifest: '/manifest.json',
  // Phase 8: Apple-specific PWA meta tags for Add to Home Screen behavior
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SpottracK',
  },
}

/**
 * Viewport export — separated from Metadata per Next.js 14 recommendation.
 * Locks zoom to 1:1 to prevent accidental double-tap-to-zoom on mobile,
 * matching native app behavior expected from a PWA.
 * themeColor controls the browser chrome color on Android and Safari tab bar.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Phase 8: matches manifest.json theme_color — dark chrome for both themes
  themeColor: '#0D0D0D',
}

/**
 * RootLayout wraps every page in the app.
 * - suppressHydrationWarning on <html> prevents next-themes hydration mismatch warnings.
 * - The apple-touch-icon <link> must be a raw tag here; the Metadata API does not
 *   expose a dedicated field for it (it uses the `icons` field for favicon only).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Phase 8: Apple Home Screen icon — used when user taps "Add to Home Screen" on iOS */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${orbitron.variable} bg-brand-magenta dark:bg-surface-dark min-h-screen`}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  )
}
