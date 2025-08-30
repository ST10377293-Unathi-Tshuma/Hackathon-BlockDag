import { NextRequest, NextResponse } from 'next/server'
import { RideOption } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickup = searchParams.get('pickup')
    const destination = searchParams.get('destination')
    const type = searchParams.get('type')

    if (!pickup || !destination) {
      return NextResponse.json(
        { success: false, error: 'Pickup and destination are required' },
        { status: 400 }
      )
    }

    // Generate mock ride options
    const rideOptions: RideOption[] = [
      {
        id: 'standard',
        name: 'Standard Ride',
        description: 'Comfortable ride with a professional driver',
        estimatedTime: '15-20 min',
        capacity: 4,
        price: Math.floor(Math.random() * 20) + 15, // $15-35
        type: 'standard',
        features: ['Professional driver', 'Clean vehicle', 'GPS tracking']
      },
      {
        id: 'premium',
        name: 'Premium Ride',
        description: 'Luxury vehicle with premium service',
        estimatedTime: '12-18 min',
        capacity: 4,
        price: Math.floor(Math.random() * 30) + 35, // $35-65
        type: 'premium',
        features: ['Luxury vehicle', 'Premium driver', 'Priority booking', 'Free water']
      },
      {
        id: 'shared',
        name: 'Shared Ride',
        description: 'Share your ride and save money',
        estimatedTime: '20-30 min',
        capacity: 6,
        price: Math.floor(Math.random() * 15) + 8, // $8-23
        type: 'shared',
        features: ['Cost effective', 'Eco-friendly', 'Meet new people']
      }
    ]

    // Filter by type if specified
    const filteredOptions = type && type !== 'all' 
      ? rideOptions.filter(option => option.type === type)
      : rideOptions

    return NextResponse.json({
      success: true,
      data: filteredOptions
    })
  } catch (error) {
    console.error('Get ride options error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
