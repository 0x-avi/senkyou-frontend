import type { Metadata } from 'next'
import { Cormorant_Garamond, Lato } from 'next/font/google'
import { Providers } from '@/providers/Providers'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-cormorant',
  display: 'swap',
})

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  variable: '--font-lato',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Senkyou',
  description: 'A curated learning sanctuary',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${lato.variable}`}>
      <body className="bg-[#0a0804] font-['Lato',sans-serif] antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}