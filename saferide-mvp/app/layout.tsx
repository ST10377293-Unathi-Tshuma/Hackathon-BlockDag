import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/lib/auth-context"
import "./globals.css"

export const metadata: Metadata = {
  title: "SafeRide - Blockchain-Powered Ride Sharing",
  description:
    "Experience the future of ride-sharing with blockchain-verified drivers, anonymous bookings, and transparent transactions on BlockDAG.",
  generator: "v0.app",
  keywords: ["blockchain", "ride sharing", "SafeRide", "BlockDAG", "decentralized", "crypto", "Web3"],
  authors: [{ name: "SafeRide Team" }],
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
  themeColor: "#059669",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen`}>
        <AuthProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <div className="flex flex-col min-h-screen">
              <main className="flex-1">{children}</main>
            </div>
          </Suspense>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
