import { NextRequest, NextResponse } from 'next/server';
import { mockDb } from '@/lib/mock-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, full_name, phone, user_type } = body;

    // Validate required fields
    if (!email || !password || !full_name || !user_type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate user type
    if (!['rider', 'driver'].includes(user_type)) {
      return NextResponse.json(
        { error: 'Invalid user type. Must be either rider or driver' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = mockDb.findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = mockDb.createUser({
      email,
      password,
      full_name,
      phone,
      user_type
    });

    // Generate mock tokens
    const tokens = mockDb.generateTokens(newUser.id);

    return NextResponse.json({
      user: newUser,
      tokens
    }, { status: 201 });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}