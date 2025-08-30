"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Shield, Car, Wallet, Users, CheckCircle, ArrowRight, Star, Menu, X, User } from "lucide-react"
import Link from "next/link"

export default function SafeRideLanding() {
  const [isWalletConnected, setIsWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Check if wallet is already connected on page load
  useEffect(() => {
    checkWalletConnection().catch((error) => {
      console.error("Failed to check wallet connection:", error)
    })
  }, [])

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" })
        if (accounts.length > 0) {
          setIsWalletConnected(true)
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error checking wallet connection:", error)
        setIsWalletConnected(false)
        setWalletAddress("")
      }
    }
  }

  const connectWallet = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsConnecting(true)
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" })
        if (accounts.length > 0) {
          setIsWalletConnected(true)
          setWalletAddress(accounts[0])
        }
      } catch (error) {
        console.error("Error connecting wallet:", error)
        setIsWalletConnected(false)
        setWalletAddress("")
      } finally {
        setIsConnecting(false)
      }
    } else {
      alert("Please install MetaMask to use SafeRide!")
    }
  }

  const disconnectWallet = () => {
    setIsWalletConnected(false)
    setWalletAddress("")
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">SafeRide</span>
            </div>

            <div className="hidden md:flex items-center gap-4">
              {isWalletConnected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    <Wallet className="w-3 h-3 mr-1" />
                    {formatAddress(walletAddress)}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/5 bg-transparent w-full sm:w-auto transition-all duration-200 hover:scale-105"
                    asChild
                  >
                    <Link href="/dashboard">
                      <User className="w-5 h-5 mr-2" />
                      Dashboard
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button onClick={connectWallet} disabled={isConnecting} className="bg-primary hover:bg-primary/90">
                  <Wallet className="w-4 h-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Button variant="ghost" size="sm" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile menu */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-border pt-4 animate-in slide-in-from-top-2 duration-200">
              <div className="space-y-3">
                {isWalletConnected ? (
                  <div className="space-y-2">
                    <Badge
                      variant="secondary"
                      className="bg-primary/10 text-primary border-primary/20 w-full justify-center"
                    >
                      <Wallet className="w-3 h-3 mr-1" />
                      {formatAddress(walletAddress)}
                    </Badge>
                    <Button variant="outline" size="sm" onClick={disconnectWallet} className="w-full bg-transparent">
                      Disconnect
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/5 bg-transparent w-full sm:w-auto transition-all duration-200 hover:scale-105"
                      asChild
                    >
                      <Link href="/dashboard">
                        <User className="w-5 h-5 mr-2" />
                        Dashboard
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={connectWallet}
                    disabled={isConnecting}
                    className="bg-primary hover:bg-primary/90 w-full"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4">
        <div className="container mx-auto text-center max-w-4xl">
          <div className="mb-6">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-4 text-xs sm:text-sm">
              Blockchain-Powered Ride Sharing
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6 text-balance leading-tight">
            Safe, Secure, and
            <span className="text-primary"> Decentralized</span> Rides
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground mb-8 text-pretty max-w-2xl mx-auto leading-relaxed">
            Experience the future of ride-sharing with blockchain-verified drivers, anonymous bookings, and transparent
            transactions on BlockDAG.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center max-w-md sm:max-w-none mx-auto">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link href="/book">
                <Car className="w-5 h-5 mr-2" />
                Book a Ride
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary text-primary hover:bg-primary/5 bg-transparent w-full sm:w-auto transition-all duration-200 hover:scale-105"
              asChild
            >
              <Link href="/driver/verify">
                <Shield className="w-5 h-5 mr-2" />
                Become a Driver
              </Link>
            </Button>
            {isWalletConnected && (
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5 bg-transparent w-full sm:w-auto transition-all duration-200 hover:scale-105"
                asChild
              >
                <Link href="/dashboard">
                  <User className="w-5 h-5 mr-2" />
                  Dashboard
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Why Choose SafeRide?</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Built on blockchain technology for maximum security, transparency, and trust.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <Card className="border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-foreground text-lg sm:text-xl">Verified Drivers</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  All drivers undergo blockchain-verified identity checks and background verification.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Identity verification</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Background checks</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-foreground text-lg sm:text-xl">Anonymous Booking</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Book rides with anonymized profiles while maintaining safety and accountability.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Privacy protection</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Secure matching</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 md:col-span-1">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-foreground text-lg sm:text-xl">Blockchain Payments</CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Transparent, secure payments powered by BlockDAG with smart contract escrow.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Smart contracts</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  <span>Instant settlements</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">How SafeRide Works</h2>
            <p className="text-muted-foreground text-base sm:text-lg">
              Simple, secure, and transparent ride-sharing in three easy steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            <div className="text-center group">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                <span className="text-2xl font-bold text-primary-foreground">1</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Connect Wallet</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Connect your MetaMask wallet to access the SafeRide platform securely.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                <span className="text-2xl font-bold text-primary-foreground">2</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Book or Drive</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Request a ride or register as a verified driver to start earning.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg">
                <span className="text-2xl font-bold text-primary-foreground">3</span>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2">Ride Safely</h3>
              <p className="text-muted-foreground text-sm sm:text-base">
                Enjoy secure, transparent rides with blockchain-verified participants.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div className="group">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-2 transition-transform duration-300 group-hover:scale-110">
                1,000+
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">Verified Drivers</div>
            </div>
            <div className="group">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-2 transition-transform duration-300 group-hover:scale-110">
                5,000+
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">Safe Rides</div>
            </div>
            <div className="group">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-2 transition-transform duration-300 group-hover:scale-110">
                4.9
              </div>
              <div className="text-muted-foreground flex items-center justify-center gap-1 text-sm sm:text-base">
                <Star className="w-4 h-4 fill-primary text-primary" />
                Rating
              </div>
            </div>
            <div className="group">
              <div className="text-2xl sm:text-3xl font-bold text-primary mb-2 transition-transform duration-300 group-hover:scale-110">
                24/7
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 px-4">
        <div className="container mx-auto text-center max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">Ready to Experience Safe Rides?</h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-8">
            Join thousands of users who trust SafeRide for secure, blockchain-powered transportation.
          </p>

          {!isWalletConnected ? (
            <Button
              size="lg"
              onClick={connectWallet}
              disabled={isConnecting}
              className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 w-full sm:w-auto"
            >
              <Wallet className="w-5 h-5 mr-2" />
              {isConnecting ? "Connecting Wallet..." : "Get Started - Connect Wallet"}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center max-w-md sm:max-w-none mx-auto">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 w-full sm:w-auto"
                asChild
              >
                <Link href="/book">
                  <Car className="w-5 h-5 mr-2" />
                  Book Your First Ride
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5 bg-transparent transition-all duration-200 hover:scale-105 w-full sm:w-auto"
                asChild
              >
                <Link href="/driver/verify">
                  <Shield className="w-5 h-5 mr-2" />
                  Apply to Drive
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5 bg-transparent transition-all duration-200 hover:scale-105 w-full sm:w-auto"
                asChild
              >
                <Link href="/dashboard">
                  <User className="w-5 h-5 mr-2" />
                  My Dashboard
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 sm:py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">SafeRide</span>
            </div>

            <div className="text-center md:text-right">
              <p className="text-muted-foreground text-sm">
                Powered by BlockDAG • Built for Safety • Designed for Trust
              </p>
              <p className="text-muted-foreground text-xs mt-1">© 2024 SafeRide MVP. Hackathon Project.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
