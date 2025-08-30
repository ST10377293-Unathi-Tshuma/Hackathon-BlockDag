import { NextRequest, NextResponse } from 'next/server'
import { mockDb } from '@/lib/mock-db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const { searchParams } = new URL(request.url)
    
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

    // Parse pagination parameters
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Generate mock ride history
    const mockRides = [
      {
        id: '1',
        riderId: userId,
        driverId: 'driver-1',
        driverName: 'John D.',
        from: 'Downtown Mall',
        to: 'Airport Terminal 1',
        date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        duration: 25,
        distance: 15.2,
        fare: 28.50,
        status: 'completed',
        rating: 5,
        paymentMethod: 'Credit Card'
      },
      {
        id: '2',
        riderId: userId,
        driverId: 'driver-2',
        driverName: 'Sarah M.',
        from: 'Home',
        to: 'Office Building',
        date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        duration: 18,
        distance: 8.7,
        fare: 15.75,
        status: 'completed',
        rating: 4,
        paymentMethod: 'Wallet'
      },
      {
        id: '3',
        riderId: userId,
        driverId: 'driver-3',
        driverName: 'Mike R.',
        from: 'Restaurant District',
        to: 'Home',
        date: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        duration: 22,
        distance: 12.1,
        fare: 22.00,
        status: 'completed',
        rating: 5,
        paymentMethod: 'Credit Card'
      },
      {
        id: '4',
        riderId: userId,
        driverId: 'driver-4',
        driverName: 'Lisa K.',
        from: 'Shopping Center',
        to: 'University Campus',
        date: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
        duration: 30,
        distance: 18.5,
        fare: 32.25,
        status: 'completed',
        rating: 4,
        paymentMethod: 'Wallet'
      },
      {
        id: '5',
        riderId: userId,
        driverId: 'driver-5',
        driverName: 'Tom W.',
        from: 'Train Station',
        to: 'Hotel District',
        date: new Date(Date.now() - 604800000).toISOString(), // 1 week ago
        duration: 15,
        distance: 6.8,
        fare: 12.50,
        status: 'completed',
        rating: 5,
        paymentMethod: 'Credit Card'
      }
    ]

    // Apply pagination
    const paginatedRides = mockRides.slice(offset, offset + limit)
    const totalRides = mockRides.length
    const totalPages = Math.ceil(totalRides / limit)
    
    return NextResponse.json({
      success: true,
      data: {
        rides: paginatedRides,
        pagination: {
          page,
          limit,
          total: totalRides,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    })
  } catch (error) {
    console.error('Get user ride history error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}