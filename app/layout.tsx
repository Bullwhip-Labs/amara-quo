// /app/layout.tsx
// Root layout for Amara QUO Intelligence Monitor
// Sets up the application shell with minimal chrome

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Amara QUO - Intelligence Monitor',
  description: 'AI Agent monitoring and response system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-[var(--color-background)]">
            {/* Main Content - No nav needed, header is in dashboard */}
            {children}
          </div>
          <Toaster 
            position="bottom-right"
            toastOptions={{
              className: 'font-sans',
            }}
          />
        </Providers>
      </body>
    </html>
  )
}