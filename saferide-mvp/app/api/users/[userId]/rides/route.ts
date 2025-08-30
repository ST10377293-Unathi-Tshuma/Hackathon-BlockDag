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
        status: '