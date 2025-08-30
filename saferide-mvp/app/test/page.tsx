"use client"

import { useState, useEffect } from "react"

export default function TestPage() {
  const [profileData, setProfileData] = useState<any>(null)
  const [statsData, setStatsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testAPIs = async () => {
      try {
        // Test with user ID 1 (test user)
        const profileResponse = await fetch('/api/users/1/profile')
        const statsResponse = await fetch('/api/users/1/stats')
        
        const profileJson = await profileResponse.json()
        const statsJson = await statsResponse.json()
        
        console.log("Profile response:", profileJson)
        console.log("Stats response:", statsJson)
        
        setProfileData(profileJson)
        setStatsData(statsJson)
      } catch (err) {
        console.error("API test error:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    }
    
    testAPIs()
  }, [])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Test Results</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Profile Data:</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(profileData, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Stats Data:</h2>
        <pre className="bg-gray-100 p-4 rounded">
          {JSON.stringify(statsData, null, 2)}
        </pre>
      </div>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Data Check:</h2>
        <p>Profile success: {profileData?.success ? "Yes" : "No"}</p>
        <p>Stats success: {statsData?.success ? "Yes" : "No"}</p>
        <p>Profile data exists: {profileData?.data ? "Yes" : "No"}</p>
        <p>Stats data exists: {statsData?.data ? "Yes" : "No"}</p>
        <p>Profile name: {profileData?.data?.full_name || "No name"}</p>
        <p>Stats total rides: {statsData?.data?.totalRides || "No rides"}</p>
      </div>
    </div>
  )
}
