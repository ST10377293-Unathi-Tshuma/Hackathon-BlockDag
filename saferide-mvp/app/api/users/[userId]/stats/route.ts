import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/lib/mock-db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      )
    }

    const user = mockDb.findUserById(userId)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate mock statistics for the user
    const stats = {
      totalRides: Math.floor(Math.random() * 50) + 10, // 10-60 rides
      totalSpent: Math.floor(Math.random() * 500) + 50, // $50-550
      rating: parseFloat((Math.random() * 2 + 3).toFixed(1)), // 3.0-5.0 rating
      carbonSaved: Math.floor(Math.random() * 100) + 20, // 20-120 kg CO2
      favoriteDestinations: ['Downtown Area', 'Airport', 'Shopping Mall'],
      monthlyRides: Math.floor(Math.random() * 10) + 1 // 1-11 rides
    }
    
    return NextResponse.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Get user stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}