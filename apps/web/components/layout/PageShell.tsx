import { AppHeader } from './AppHeader'
import { BottomBar } from './BottomBar'
import { ScrollToTop } from '../ui/ScrollToTop'

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 max-w-sm sm:max-w-xl md:max-w-2xl lg:max-w-4xl mx-auto w-full px-4 md:px-8 py-6 mt-14 mb-16">
        {children}
      </main>
      <ScrollToTop />
      <BottomBar />
    </div>
  )
}
