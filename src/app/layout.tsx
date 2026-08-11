import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lumen - Enterprise Learning Platform',
  description: 'Create, deliver, and track enterprise training modules.',
  icons: { icon: '/logo.svg' },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">{children}</body>
    </html>
  )
}
