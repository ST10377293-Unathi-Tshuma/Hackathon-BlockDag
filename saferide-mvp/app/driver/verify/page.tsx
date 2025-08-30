"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Shield,
  User,
  Car,
  FileText,
  Upload,
  CheckCircle,
  ArrowLeft,
  AlertCircle,
  Camera,
  Wallet,
  BarChart3,
  LogOut,
  Loader2,
} from "lucide-react"
import Link from "next/link"
import { useBlockchain } from "@/hooks/use-blockchain"
import { useAuth } from "@/lib/auth-context"

interface FormData {
  // Personal Information
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  address: string
  city: string
  state: string
  zipCode: string

  // Vehicle Information
  vehicleMake: string
  vehicleModel: string
  vehicleYear: string
  vehicleColor: string
  licensePlate: string
  vehicleType: string

  // Documents
  driversLicense: File | null
  insurance: File | null
  vehicleRegistration: File | null
  profilePhoto: File | null

  // Agreements
  backgroundCheckConsent: boolean
  termsAccepted: boolean
  dataProcessingConsent: boolean
}

const initialFormData: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dateOfBirth: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleYear: "",
  vehicleColor: "",
  licensePlate: "",
  vehicleType: "",
  driversLicense: null,
  insurance: null,
  vehicleRegistration: null,
  profilePhoto: null,
  backgroundCheckConsent: false,
  termsAccepted: false,
  dataProcessingConsent: false,
}

export default function DriverVerification() {
  const router = useRouter()
  const { user, logout, isLoading } = useAuth()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isVerificationComplete, setIsVerificationComplete] = useState(false)
  const [isAuthChecking, setIsAuthChecking] = useState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login')
        return
      }
      setIsAuthChecking(false)
    }
  }, [user, isLoading, router])

  // Show loading spinner while checking authentication
  if (isLoading || isAuthChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Don't render if not authenticated
  if (!user) {
    return null
  }

  const {
    walletInfo,
    isConnecting,
    error: blockchainError,
    connectWallet,
    disconnectWallet,
    registerDriver,
    clearError,
  } = useBlockchain()

  const totalSteps = 4
  const progress = (currentStep / totalSteps) * 100

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const handleFileUpload = (field: keyof FormData, file: File | null) => {
    setFormData((prev) => ({ ...prev, [field]: file }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Personal Information
        if (!formData.firstName) newErrors.firstName = "First name is required"
        if (!formData.lastName) newErrors.lastName = "Last name is required"
        if (!formData.email) newErrors.email = "Email is required"
        if (!formData.phone) newErrors.phone = "Phone number is required"
        if (!formData.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required"
        if (!formData.address) newErrors.address = "Address is required"
        if (!formData.city) newErrors.city = "City is required"
        if (!formData.state) newErrors.state = "State is required"
        if (!formData.zipCode) newErrors.zipCode = "ZIP code is required"
        break

      case 2: // Vehicle Information
        if (!formData.vehicleMake) newErrors.vehicleMake = "Vehicle make is required"
        if (!formData.vehicleModel) newErrors.vehicleModel = "Vehicle model is required"
        if (!formData.vehicleYear) newErrors.vehicleYear = "Vehicle year is required"
        if (!formData.vehicleColor) newErrors.vehicleColor = "Vehicle color is required"
        if (!formData.licensePlate) newErrors.licensePlate = "License plate is required"
        if (!formData.vehicleType) newErrors.vehicleType = "Vehicle type is required"
        break

      case 3: // Document Upload
        if (!formData.driversLicense) newErrors.driversLicense = "Driver's license is required"
        if (!formData.insurance) newErrors.insurance = "Insurance document is required"
        if (!formData.vehicleRegistration) newErrors.vehicleRegistration = "Vehicle registration is required"
        if (!formData.profilePhoto) newErrors.profilePhoto = "Profile photo is required"
        break

      case 4: // Agreements
        if (!formData.backgroundCheckConsent) newErrors.backgroundCheckConsent = "Background check consent is required"
        if (!formData.termsAccepted) newErrors.termsAccepted = "Terms acceptance is required"
        if (!formData.dataProcessingConsent) newErrors.dataProcessingConsent = "Data processing consent is required"
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    if (!walletInfo.isConnected) {
      alert("Please connect your wallet to complete driver registration!")
      return
    }

    setIsSubmitting(true)
    clearError()

    try {
      const documents = [
        formData.driversLicense,
        formData.insurance,
        formData.vehicleRegistration,
        formData.profilePhoto,
      ].filter(Boolean) as File[]

      const txHash = await registerDriver(
        `${formData.firstName} ${formData.lastName}`,
        `${formData.vehicleYear} ${formData.vehicleMake} ${formData.vehicleModel}`,
        documents,
      )

      setIsVerificationComplete(true)
      console.log(`Driver registration submitted successfully! Transaction: ${txHash.slice(0, 10)}...`)
    } catch (error: any) {
      console.error("Registration failed:", error)
      alert(`Registration failed: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const FileUploadField = ({
    label,
    field,
    accept,
    icon: Icon,
  }: {
    label: string
    field: keyof FormData
    accept: string
    icon: any
  }) => (
    <div className="space-y-2">
      <Label htmlFor={field} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
        <input
          id={field}
          type="file"
          accept={accept}
          onChange={(e) => handleFileUpload(field, e.target.files?.[0] || null)}
          className="hidden"
        />
        <label htmlFor={field} className="cursor-pointer">
          <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-1">
            {formData[field] ? (formData[field] as File).name : `Upload ${label}`}
          </p>
          <p className="text-xs text-muted-foreground">Click to browse files</p>
        </label>
      </div>
      {errors[field] && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {errors[field]}
        </p>
      )}
    </div>
  )

  if (isVerificationComplete) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">SafeRide</span>
              </Link>

              <div className="flex items-center gap-2">
                {walletInfo.isConnected && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20 text-xs sm:text-sm"
                  >
                    <Wallet className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">
                      {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                    </span>
                    <span className="sm:hidden">{walletInfo.address.slice(0, 4)}...</span>
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="shadow-lg text-center">
            <CardContent className="p-8">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-primary-foreground" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-4">Verification Submitted Successfully!</h1>

              <p className="text-muted-foreground mb-6">
                Your driver verification has been submitted to the blockchain. You'll receive an email notification once
                your verification is approved, typically within 24-48 hours.
              </p>

              <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg mb-6">
                <h3 className="font-medium text-foreground mb-2">What's Next?</h3>
                <ul className="text-sm text-muted-foreground space-y-1 text-left">
                  <li>• Background check processing (24-48 hours)</li>
                  <li>• Document verification review</li>
                  <li>• Blockchain registration confirmation</li>
                  <li>• Email notification upon approval</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="bg-primary hover:bg-primary/90">
                  <Link href="/driver/dashboard">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Go to Driver Dashboard
                  </Link>
                </Button>

                <Button variant="outline" asChild className="bg-transparent">
                  <Link href="/">
                    <Shield className="w-4 h-4 mr-2" />
                    Back to Home
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">SafeRide</span>
            </Link>

            <div className="flex items-center gap-2">
              {walletInfo.isConnected ? (
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary border-primary/20 text-xs sm:text-sm"
                  >
                    <Wallet className="w-3 h-3 mr-1" />
                    <span className="hidden sm:inline">
                      {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                    </span>
                    <span className="sm:hidden">{walletInfo.address.slice(0, 4)}...</span>
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectWallet}
                    className="text-xs sm:text-sm bg-transparent"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="text-xs sm:text-sm bg-transparent hidden sm:flex"
                  >
                    <Link href="/driver/dashboard">
                      <BarChart3 className="w-4 h-4 mr-1" />
                      Dashboard
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button onClick={connectWallet} disabled={isConnecting} size="sm" className="text-xs sm:text-sm">
                  <Wallet className="w-4 h-4 mr-2" />
                  {isConnecting ? "Connecting..." : "Connect Wallet"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 sm:py-8 max-w-2xl">
        {blockchainError && (
          <Alert className="mb-6 border-destructive/50 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {blockchainError}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearError}
                className="ml-2 h-auto p-0 text-destructive hover:text-destructive/80"
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!walletInfo.isConnected && (
          <Alert className="mb-6 border-primary/50">
            <Wallet className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Connect your wallet to register as a driver on the blockchain.
              <Button
                variant="ghost"
                size="sm"
                onClick={connectWallet}
                className="ml-2 h-auto p-0 text-primary hover:text-primary/80"
              >
                Connect Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Driver Verification</h1>
            <span className="text-xs sm:text-sm text-muted-foreground">
              Step {currentStep} of {totalSteps}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              {currentStep === 1 && <User className="w-5 h-5 text-primary" />}
              {currentStep === 2 && <Car className="w-5 h-5 text-primary" />}
              {currentStep === 3 && <Upload className="w-5 h-5 text-primary" />}
              {currentStep === 4 && <FileText className="w-5 h-5 text-primary" />}
              {currentStep === 1 && "Personal Information"}
              {currentStep === 2 && "Vehicle Information"}
              {currentStep === 3 && "Document Upload"}
              {currentStep === 4 && "Verification & Agreements"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {currentStep === 1 && "Please provide your personal details for verification."}
              {currentStep === 2 && "Tell us about your vehicle."}
              {currentStep === 3 && "Upload required documents for verification."}
              {currentStep === 4 && "Review and accept terms to complete verification."}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Step 1: Personal Information */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) => handleInputChange("firstName", e.target.value)}
                      className={errors.firstName ? "border-destructive" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.firstName}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) => handleInputChange("lastName", e.target.value)}
                      className={errors.lastName ? "border-destructive" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.lastName}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className={errors.email ? "border-destructive" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.email}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className={errors.phone ? "border-destructive" : ""}
                    />
                    {errors.phone && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.phone}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                    className={errors.dateOfBirth ? "border-destructive" : ""}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.dateOfBirth}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    className={errors.address ? "border-destructive" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.address}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      className={errors.city ? "border-destructive" : ""}
                    />
                    {errors.city && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.city}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                      <SelectTrigger className={errors.state ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CA">California</SelectItem>
                        <SelectItem value="NY">New York</SelectItem>
                        <SelectItem value="TX">Texas</SelectItem>
                        <SelectItem value="FL">Florida</SelectItem>
                        {/* Add more states as needed */}
                      </SelectContent>
                    </Select>
                    {errors.state && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.state}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => handleInputChange("zipCode", e.target.value)}
                      className={errors.zipCode ? "border-destructive" : ""}
                    />
                    {errors.zipCode && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.zipCode}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Vehicle Information */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleMake">Vehicle Make</Label>
                    <Input
                      id="vehicleMake"
                      value={formData.vehicleMake}
                      onChange={(e) => handleInputChange("vehicleMake", e.target.value)}
                      placeholder="e.g., Toyota"
                      className={errors.vehicleMake ? "border-destructive" : ""}
                    />
                    {errors.vehicleMake && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.vehicleMake}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleModel">Vehicle Model</Label>
                    <Input
                      id="vehicleModel"
                      value={formData.vehicleModel}
                      onChange={(e) => handleInputChange("vehicleModel", e.target.value)}
                      placeholder="e.g., Camry"
                      className={errors.vehicleModel ? "border-destructive" : ""}
                    />
                    {errors.vehicleModel && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.vehicleModel}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleYear">Vehicle Year</Label>
                    <Select
                      value={formData.vehicleYear}
                      onValueChange={(value) => handleInputChange("vehicleYear", value)}
                    >
                      <SelectTrigger className={errors.vehicleYear ? "border-destructive" : ""}>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 15 }, (_, i) => 2024 - i).map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.vehicleYear && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.vehicleYear}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vehicleColor">Vehicle Color</Label>
                    <Input
                      id="vehicleColor"
                      value={formData.vehicleColor}
                      onChange={(e) => handleInputChange("vehicleColor", e.target.value)}
                      placeholder="e.g., Silver"
                      className={errors.vehicleColor ? "border-destructive" : ""}
                    />
                    {errors.vehicleColor && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-4 h-4" />
                        {errors.vehicleColor}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="licensePlate">License Plate Number</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => handleInputChange("licensePlate", e.target.value)}
                    placeholder="e.g., ABC123"
                    className={errors.licensePlate ? "border-destructive" : ""}
                  />
                  {errors.licensePlate && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.licensePlate}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicleType">Vehicle Type</Label>
                  <Select
                    value={formData.vehicleType}
                    onValueChange={(value) => handleInputChange("vehicleType", value)}
                  >
                    <SelectTrigger className={errors.vehicleType ? "border-destructive" : ""}>
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedan">Sedan</SelectItem>
                      <SelectItem value="suv">SUV</SelectItem>
                      <SelectItem value="hatchback">Hatchback</SelectItem>
                      <SelectItem value="coupe">Coupe</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.vehicleType && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.vehicleType}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Document Upload */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <FileUploadField
                  label="Driver's License"
                  field="driversLicense"
                  accept="image/*,.pdf"
                  icon={FileText}
                />

                <FileUploadField label="Insurance Document" field="insurance" accept="image/*,.pdf" icon={FileText} />

                <FileUploadField
                  label="Vehicle Registration"
                  field="vehicleRegistration"
                  accept="image/*,.pdf"
                  icon={FileText}
                />

                <FileUploadField label="Profile Photo" field="profilePhoto" accept="image/*" icon={Camera} />

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Document Requirements:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• All documents must be clear and readable</li>
                    <li>• Driver's license must be valid and not expired</li>
                    <li>• Insurance must be current and cover ride-sharing</li>
                    <li>• Profile photo should show your face clearly</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Step 4: Agreements */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="backgroundCheck"
                      checked={formData.backgroundCheckConsent}
                      onCheckedChange={(checked) => handleInputChange("backgroundCheckConsent", !!checked)}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="backgroundCheck"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Background Check Consent
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I consent to SafeRide conducting a background check including criminal history, driving record,
                        and identity verification.
                      </p>
                    </div>
                  </div>
                  {errors.backgroundCheckConsent && (
                    <p className="text-sm text-destructive flex items-center gap-1 ml-6">
                      <AlertCircle className="w-4 h-4" />
                      {errors.backgroundCheckConsent}
                    </p>
                  )}

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="terms"
                      checked={formData.termsAccepted}
                      onCheckedChange={(checked) => handleInputChange("termsAccepted", !!checked)}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="terms"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Terms and Conditions
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I agree to SafeRide's Terms of Service, Driver Agreement, and Community Guidelines.
                      </p>
                    </div>
                  </div>
                  {errors.termsAccepted && (
                    <p className="text-sm text-destructive flex items-center gap-1 ml-6">
                      <AlertCircle className="w-4 h-4" />
                      {errors.termsAccepted}
                    </p>
                  )}

                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="dataProcessing"
                      checked={formData.dataProcessingConsent}
                      onCheckedChange={(checked) => handleInputChange("dataProcessingConsent", !!checked)}
                    />
                    <div className="space-y-1">
                      <Label
                        htmlFor="dataProcessing"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Data Processing Consent
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        I consent to the processing of my personal data for verification purposes and blockchain
                        integration.
                      </p>
                    </div>
                  </div>
                  {errors.dataProcessingConsent && (
                    <p className="text-sm text-destructive flex items-center gap-1 ml-6">
                      <AlertCircle className="w-4 h-4" />
                      {errors.dataProcessingConsent}
                    </p>
                  )}
                </div>

                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Blockchain Verification</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Your verification will be recorded on the BlockDAG blockchain for transparency and security.
                        This creates an immutable record of your driver status.
                      </p>
                      {walletInfo.isConnected && (
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Wallet:</span>
                            <span className="font-mono">
                              {walletInfo.address.slice(0, 10)}...{walletInfo.address.slice(-6)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Network:</span>
                            <span>BlockDAG</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="flex items-center gap-2 order-2 sm:order-1 bg-transparent"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !walletInfo.isConnected}
                className="bg-primary hover:bg-primary/90 flex items-center gap-2 order-1 sm:order-2 transition-all duration-200 hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span className="hidden sm:inline">Submitting to Blockchain...</span>
                    <span className="sm:hidden">Submitting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Submit Verification
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
