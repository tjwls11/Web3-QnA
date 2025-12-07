import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { WalletProvider } from '@/lib/wallet-context'
import { GlobalErrorHandler } from '@/components/global-error-handler'
import { Footer } from '@/components/footer'

const geist = Geist({ subsets: ['latin'] })
const geistMono = Geist_Mono({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WAK QnA',
  description: 'Web3 기반 지식공유 및 토큰 보상 시스템',
  generator: 'Next.js',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geist.className} ${geistMono.className} font-sans antialiased`}
      >
        <GlobalErrorHandler />
        <WalletProvider>
          <div className="min-h-screen flex flex-col bg-background">
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </WalletProvider>

        <Analytics />
      </body>
    </html>
  )
}
