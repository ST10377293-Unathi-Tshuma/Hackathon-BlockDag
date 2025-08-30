import { NextRequest, NextResponse } from 'next/server'
import { Driver } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pickup = searchParams.get('pickup') || 'Unknown Location'
    const destination = searchParams.get('destination') || 'Unknown Destination'
    const type = searchParams.get('type') || 'standard'
    const max = parseInt(searchParams.get('max') || '5')

    // Generate mock driver data
    const mockDrivers: Driver[] = Array.from({ length: Math.min(max, 5) }, (_, index) => ({
      id: `driver_${index + 1}`,
      user_id: `user_${index + 1}`,
      license_number: `LIC${String(index + 1).padStart(6, '0')}`,
      vehicle_info: {
        make: ['Toyota', 'Honda', 'Ford', 'Nissan', 'Hyundai'][index % 5],
        model: ['Camry', 'Civic', 'Focus', 'Altima', 'Elantra'][index % 5],
        year: 2020 + (index % 4),
        color: ['White', 'Black', 'Silver', 'Blue', 'Red'][index % 5],
        plate_number: `ABC${String(index + 1).padStart(3, '0')}`
      },
      verification_status: index === 0 ? 'verified' : index === 1 ? 'pending' : 'unverified',
      rating: parseFloat((4.0 + Math.random() * 1.0).toFixed(1)),
      total_rides: Math.floor(Math.random() * 500) + 50,
      is_available: true,
      current_location: {
        latitude: 37.7749 + (Math.random() - 0.5) * 0.1,
        longitude: -122.4194 + (Math.random() - 0.5) * 0.1,
        address: `${pickup} area`
      },
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }))

    return NextResponse.json({
      success: true,
      data: mockDrivers
    })
  } catch (error) {
    console.error('Search drivers error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
