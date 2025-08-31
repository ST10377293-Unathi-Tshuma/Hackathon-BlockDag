"use client"

import type React from "react"

import { useState, useMemo, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  Search,
  MessageCircle,
  Phone,
  Mail,
  Book,
  Users,
  AlertCircle,
  CheckCircle,
  HelpCircle,
  Wallet,
  Car,
  Send,
  ChevronRight,
  Home,
  User,
} from "lucide-react"
import Link from "next/link"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { useDebouncedSearch } from "@/hooks/useDebounce"

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
}

interface HelpArticle {
  id: string
  title: string
  description: string
  category: string
  readTime: string
}

const HelpAndSupport = memo(() => {
  const { searchValue, debouncedValue: debouncedSearchQuery, setSearchValue, isSearching } = useDebouncedSearch()
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    category: "general",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const faqs: FAQ[] = [
    {
      id: "1",
      question: "How do I connect my wallet to SafeRide?",
      answer:
        "To connect your wallet, click the 'Connect Wallet' button in the top right corner of any page. Make sure you have MetaMask or another compatible wallet installed. Follow the prompts to authorize the connection.",
      category: "wallet",
    },
    {
      id: "2",
      question: "How are payments processed on SafeRide?",
      answer:
        "All payments are processed through smart contracts on the BlockDAG blockchain. When you book a ride, funds are held in escrow until the trip is completed, ensuring secure transactions for both riders and drivers.",
      category: "payments",
    },
    {
      id: "3",
      question: "How do I become a verified driver?",
      answer:
        "To become a driver, complete our verification process which includes identity verification, background checks, vehicle inspection, and document upload. The entire process typically takes 24-48 hours.",
      category: "driver",
    },
    {
      id: "4",
      question: "What information is kept anonymous?",
      answer:
        "SafeRide protects your privacy by using anonymous driver and rider profiles. Personal information is encrypted and only essential details are shared for safety purposes.",
      category: "privacy",
    },
    {
      id: "5",
      question: "How do I cancel a ride?",
      answer:
        "You can cancel a ride through your dashboard or the rides page. Cancellation fees may apply depending on timing. Scheduled rides can be cancelled up to 1 hour before pickup without penalty.",
      category: "rides",
    },
    {
      id: "6",
      question: "What happens if there's an issue during my ride?",
      answer:
        "If you experience any issues during your ride, use the emergency contact feature in the app or call our 24/7 support line. We also have real-time ride tracking for safety.",
      category: "safety",
    },
    {
      id: "7",
      question: "How are driver ratings calculated?",
      answer:
        "Driver ratings are based on passenger feedback after each completed trip. Ratings consider factors like punctuality, vehicle condition, driving quality, and overall experience.",
      category: "ratings",
    },
    {
      id: "8",
      question: "Can I schedule rides in advance?",
      answer:
        "Yes, you can schedule rides up to 7 days in advance. Scheduled rides are confirmed 1 hour before pickup time, and you'll receive notifications about your driver assignment.",
      category: "rides",
    },
  ]

  const helpArticles: HelpArticle[] = [
    {
      id: "1",
      title: "Getting Started with SafeRide",
      description: "Complete guide to setting up your account and booking your first ride",
      category: "getting-started",
      readTime: "5 min",
    },
    {
      id: "2",
      title: "Blockchain Wallet Setup",
      description: "Step-by-step guide to connecting and managing your crypto wallet",
      category: "wallet",
      readTime: "8 min",
    },
    {
      id: "3",
      title: "Driver Verification Process",
      description: "Everything you need to know about becoming a verified SafeRide driver",
      category: "driver",
      readTime: "10 min",
    },
    {
      id: "4",
      title: "Safety Guidelines",
      description: "Important safety information for riders and drivers",
      category: "safety",
      readTime: "6 min",
    },
    {
      id: "5",
      title: "Understanding Ride Pricing",
      description: "How our transparent blockchain-based pricing works",
      category: "payments",
      readTime: "4 min",
    },
    {
      id: "6",
      title: "Privacy and Data Protection",
      description: "How SafeRide protects your personal information",
      category: "privacy",
      readTime: "7 min",
    },
  ]

  const categories = [
    { id: "all", name: "All Topics", icon: Book },
    { id: "getting-started", name: "Getting Started", icon: User },
    { id: "wallet", name: "Wallet & Payments", icon: Wallet },
    { id: "rides", name: "Rides & Booking", icon: Car },
    { id: "driver", name: "Driver Info", icon: Shield },
    { id: "safety", name: "Safety", icon: AlertCircle },
    { id: "privacy", name: "Privacy", icon: Users },
  ]

  const filteredFAQs = useMemo(() => {
    return faqs.filter((faq) => {
      const matchesSearch =
        faq.question.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [debouncedSearchQuery, selectedCategory])

  const filteredArticles = useMemo(() => {
    return helpArticles.filter((article) => {
      const matchesSearch =
        article.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      const matchesCategory = selectedCategory === "all" || article.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [debouncedSearchQuery, selectedCategory])

  const handleContactSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulate form submission
      await new Promise((resolve) => setTimeout(resolve, 2000))
      
      setIsSubmitted(true)
      setContactForm({
        name: "",
        email: "",
        subject: "",
        message: "",
        category: "general",
      })
    } catch (error) {
      console.error('Contact form submission error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">SafeRide</span>
              </Link>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                Help & Support
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" asChild className="bg-transparent">
                <Link href="/dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">How can we help you?</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Find answers to common questions, get support, and learn how to make the most of SafeRide.
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search for help articles, FAQs, or topics..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-12 pr-12 h-12 text-base"
              />
              {isSearching && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <MessageCircle className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Live Chat</h3>
                <p className="text-sm text-muted-foreground">Get instant help from our support team</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <Phone className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Call Support</h3>
                <p className="text-sm text-muted-foreground">24/7 phone support available</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <Mail className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-2">Email Us</h3>
                <p className="text-sm text-muted-foreground">Send us a detailed message</p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Category Filter */}
        <div className="mb-8">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => {
              const Icon = category.icon
              return (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? "bg-primary hover:bg-primary/90" : "bg-transparent"}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {category.name}
                </Button>
              )
            })}
          </div>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="faq" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
            <TabsTrigger value="faq" className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4" />
              <span className="hidden sm:inline">FAQ</span>
            </TabsTrigger>
            <TabsTrigger value="articles" className="flex items-center gap-2">
              <Book className="w-4 h-4" />
              <span className="hidden sm:inline">Articles</span>
            </TabsTrigger>
            <TabsTrigger value="contact" className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Contact</span>
            </TabsTrigger>
            <TabsTrigger value="safety" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Safety</span>
            </TabsTrigger>
          </TabsList>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Frequently Asked Questions</h2>
              <p className="text-muted-foreground mb-6">
                Find quick answers to the most common questions about SafeRide.
              </p>

              {filteredFAQs.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <HelpCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No FAQs found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or category filter to find relevant questions.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Accordion type="single" collapsible className="space-y-4">
                  {filteredFAQs.map((faq) => (
                    <AccordionItem key={faq.id} value={faq.id} className="border border-border rounded-lg px-4">
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="font-medium text-foreground">{faq.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground pt-2 pb-4">{faq.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </TabsContent>

          {/* Articles Tab */}
          <TabsContent value="articles" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Help Articles</h2>
              <p className="text-muted-foreground mb-6">
                Detailed guides and tutorials to help you get the most out of SafeRide.
              </p>

              {filteredArticles.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Book className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No articles found</h3>
                    <p className="text-muted-foreground">
                      Try adjusting your search or category filter to find relevant articles.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredArticles.map((article) => (
                    <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <Badge variant="secondary" className="text-xs">
                            {categories.find((c) => c.id === article.category)?.name || article.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{article.readTime}</span>
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">{article.description}</p>
                        <div className="flex items-center text-primary text-sm font-medium">
                          Read article
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Contact Tab */}
          <TabsContent value="contact" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Contact Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Send us a message</CardTitle>
                  <CardDescription>
                    Fill out the form below and we'll get back to you as soon as possible.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isSubmitted ? (
                    <Alert className="border-primary/50 bg-primary/5">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-primary">
                        Thank you for contacting us! We'll respond within 24 hours.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            value={contactForm.name}
                            onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            value={contactForm.email}
                            onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          value={contactForm.category}
                          onChange={(e) => setContactForm({ ...contactForm, category: e.target.value })}
                          className="w-full p-2 border border-border rounded-md bg-background"
                        >
                          <option value="general">General Question</option>
                          <option value="technical">Technical Issue</option>
                          <option value="billing">Billing & Payments</option>
                          <option value="safety">Safety Concern</option>
                          <option value="driver">Driver Support</option>
                          <option value="feedback">Feedback</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          value={contactForm.subject}
                          onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          rows={5}
                          value={contactForm.message}
                          onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                          placeholder="Please describe your question or issue in detail..."
                          required
                        />
                      </div>

                      <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90">
                        {isSubmitting ? (
                          <>
                            <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-2" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* Contact Information */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Other ways to reach us</CardTitle>
                    <CardDescription>Choose the contact method that works best for you.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <MessageCircle className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Live Chat</p>
                        <p className="text-sm text-muted-foreground">Available 24/7 for instant support</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Phone className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Phone Support</p>
                        <p className="text-sm text-muted-foreground">+1 (555) 123-SAFE (7233)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 border border-border rounded-lg">
                      <Mail className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium text-foreground">Email Support</p>
                        <p className="text-sm text-muted-foreground">support@saferide.com</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Response Times</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Live Chat</span>
                      <span className="text-sm font-medium text-foreground">Instant</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <span className="text-sm font-medium text-foreground">Immediate</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Email</span>
                      <span className="text-sm font-medium text-foreground">Within 24 hours</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Contact Form</span>
                      <span className="text-sm font-medium text-foreground">Within 24 hours</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Safety Tab */}
          <TabsContent value="safety" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Safety Information</h2>
              <p className="text-muted-foreground mb-6">
                Your safety is our top priority. Here's important safety information for using SafeRide.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      For Riders
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Verify your driver</p>
                        <p className="text-xs text-muted-foreground">
                          Check license plate and driver photo before getting in
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Share your trip</p>
                        <p className="text-xs text-muted-foreground">
                          Let friends or family track your ride in real-time
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Trust your instincts</p>
                        <p className="text-xs text-muted-foreground">
                          If something feels wrong, end the trip immediately
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Emergency features</p>
                        <p className="text-xs text-muted-foreground">
                          Use in-app emergency button or call 911 if needed
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="w-5 h-5 text-primary" />
                      For Drivers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Vehicle maintenance</p>
                        <p className="text-xs text-muted-foreground">Keep your vehicle in safe, clean condition</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Follow traffic laws</p>
                        <p className="text-xs text-muted-foreground">
                          Always drive safely and obey all traffic regulations
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Verify passengers</p>
                        <p className="text-xs text-muted-foreground">
                          passenger identity before starting the trip
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-foreground text-sm">Report issues</p>
                        <p className="text-xs text-muted-foreground">Report any safety concerns immediately</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Alert className="border-destructive/50 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  <strong>Emergency:</strong> In case of immediate danger, call 911 first, then contact SafeRide
                  support. Our 24/7 emergency line: +1 (555) 911-SAFE
                </AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <CardTitle>Community Guidelines</CardTitle>
                  <CardDescription>Help us maintain a safe and respectful community for everyone.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Respect</h4>
                      <p className="text-sm text-muted-foreground">
                        Treat all users with courtesy and respect, regardless of background or differences.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Safety First</h4>
                      <p className="text-sm text-muted-foreground">
                        Follow all safety guidelines and report any concerning behavior immediately.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-2">No Discrimination</h4>
                      <p className="text-sm text-muted-foreground">
                        Discrimination based on race, gender, religion, or other factors is strictly prohibited.
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Privacy</h4>
                      <p className="text-sm text-muted-foreground">
                        Respect others' privacy and do not share personal information without consent.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
})

HelpAndSupport.displayName = 'HelpAndSupport'

// Wrapper component with ErrorBoundary
const HelpAndSupportWithErrorBoundary = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Help Page Error:', error, errorInfo)
        // In a real app, you might want to send this to an error reporting service
      }}
    >
      <HelpAndSupport />
    </ErrorBoundary>
  )
}

export default HelpAndSupportWithErrorBoundary
