import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';
import { Logger } from '../middleware/logger';
import { AppError, ValidationError, NotFoundError } from '../middleware/errorHandler';
import { asyncHandler } from '../middleware/errorHandler';

const app = express();
const logger = new Logger();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// WebSocket server for real-time tracking
const wss = new WebSocket.Server({ port: parseInt(process.env.EMERGENCY_WS_PORT || '3004') });

// Store active tracking sessions
const activeTrackingSessions = new Map<string, {
  userId: string;
  rideId?: string;
  emergencyId?: string;
  connections: Set<WebSocket>;
  lastLocation?: { latitude: number; longitude: number; timestamp: string };
}>();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Types
interface EmergencyAlert {
  user_id: string;
  ride_id?: string;
  alert_type: 'panic_button' | 'route_deviation' | 'prolonged_stop' | 'speed_violation' | 'manual_trigger';
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  metadata?: any;
}

interface LocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

interface EmergencyContact {
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  is_primary: boolean;
}

// Helper Functions
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const sendSMSAlert = async (phone: string, message: string): Promise<boolean> => {
  try {
    // Implement SMS sending logic here (Twilio, AWS SNS, etc.)
    // For now, we'll just log the message
    logger.info('SMS Alert sent', { phone: phone.replace(/.(?=.{4})/g, '*'), message });
    return true;
  } catch (error) {
    logger.error('Failed to send SMS alert', { error, phone });
    return false;
  }
};

const sendEmailAlert = async (email: string, subject: string, message: string): Promise<boolean> => {
  try {
    // Implement email sending logic here (SendGrid, AWS SES, etc.)
    // For now, we'll just log the message
    logger.info('Email Alert sent', { email, subject, message });
    return true;
  } catch (error) {
    logger.error('Failed to send email alert', { error, email });
    return false;
  }
};

const notifyEmergencyContacts = async (userId: string, alertType: string, location: any, rideId?: string) => {
  try {
    // Get emergency contacts
    const { data: contacts, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId);

    if (error || !contacts || contacts.length === 0) {
      logger.warn('No emergency contacts found', { userId });
      return;
    }

    // Get user info for the alert
    const { data: user } = await supabase
      .from('saferide_users')
      .select('email, phone')
      .eq('id', userId)
      .single();

    const userName = user?.email?.split('@')[0] || 'SafeRide User';
    const alertMessage = `EMERGENCY ALERT: ${userName} has triggered a ${alertType} alert. Location: ${location.address || `${location.latitude}, ${location.longitude}`}. Time: ${new Date().toLocaleString()}. ${rideId ? `Ride ID: ${rideId}` : ''}`;

    // Send notifications to all emergency contacts
    for (const contact of contacts) {
      if (contact.phone) {
        await sendSMSAlert(contact.phone, alertMessage);
      }
      if (contact.email) {
        await sendEmailAlert(contact.email, 'SafeRide Emergency Alert', alertMessage);
      }
    }

    logger.info('Emergency contacts notified', { userId, contactCount: contacts.length, alertType });
  } catch (error) {
    logger.error('Failed to notify emergency contacts', { error, userId });
  }
};

const broadcastLocationUpdate = (sessionId: string, location: LocationUpdate) => {
  const session = activeTrackingSessions.get(sessionId);
  if (session) {
    session.lastLocation = {
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: location.timestamp,
    };

    const message = JSON.stringify({
      type: 'location_update',
      session_id: sessionId,
      location,
      timestamp: new Date().toISOString(),
    });

    session.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
};

// WebSocket handling
wss.on('connection', (ws: WebSocket, req) => {
  logger.info('WebSocket connection established');

  ws.on('message', async (data: string) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'join_tracking':
          const { session_id, user_id, token } = message;
          
          // Verify token
          jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
              return;
            }

            // Add to tracking session
            if (!activeTrackingSessions.has(session_id)) {
              activeTrackingSessions.set(session_id, {
                userId: user_id,
                connections: new Set(),
              });
            }

            const session = activeTrackingSessions.get(session_id)!;
            session.connections.add(ws);

            ws.send(JSON.stringify({
              type: 'joined',
              session_id,
              message: 'Successfully joined tracking session',
            }));

            logger.info('User joined tracking session', { sessionId: session_id, userId: user_id });
          });
          break;

        case 'location_update':
          const { session_id: locSessionId, location } = message;
          broadcastLocationUpdate(locSessionId, location);
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      logger.error('WebSocket message error', { error });
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    // Remove connection from all sessions
    activeTrackingSessions.forEach((session, sessionId) => {
      session.connections.delete(ws);
      if (session.connections.size === 0) {
        activeTrackingSessions.delete(sessionId);
        logger.info('Tracking session ended', { sessionId });
      }
    });
  });

  ws.on('error', (error) => {
    logger.error('WebSocket error', { error });
  });
});

// API Routes

// Trigger Emergency Alert
app.post('/alert', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const alertData: EmergencyAlert = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Validate required fields
  if (!alertData.alert_type || !alertData.location || !alertData.severity) {
    throw new ValidationError('alert_type, location, and severity are required');
  }

  // Validate alert type and severity
  const validAlertTypes = ['panic_button', 'route_deviation', 'prolonged_stop', 'speed_violation', 'manual_trigger'];
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  if (!validAlertTypes.includes(alertData.alert_type)) {
    throw new ValidationError('Invalid alert type');
  }

  if (!validSeverities.includes(alertData.severity)) {
    throw new ValidationError('Invalid severity level');
  }

  // Create emergency incident
  const { data: incident, error: incidentError } = await supabase
    .from('emergency_incidents')
    .insert({
      user_id: userId,
      ride_id: alertData.ride_id,
      incident_type: alertData.alert_type,
      description: alertData.description || `${alertData.alert_type} alert triggered`,
      severity: alertData.severity,
      status: 'active',
      location: alertData.location,
      metadata: {
        ...alertData.metadata,
        triggered_at: new Date().toISOString(),
        user_agent: req.headers['user-agent'],
      },
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (incidentError) {
    throw new AppError('Failed to create emergency incident', 500);
  }

  // Start tracking session for critical alerts
  if (alertData.severity === 'critical' || alertData.alert_type === 'panic_button') {
    const sessionId = `emergency_${incident.id}`;
    activeTrackingSessions.set(sessionId, {
      userId,
      emergencyId: incident.id,
      rideId: alertData.ride_id,
      connections: new Set(),
    });
  }

  // Notify emergency contacts
  await notifyEmergencyContacts(userId, alertData.alert_type, alertData.location, alertData.ride_id);

  // For critical alerts, also notify authorities (implement as needed)
  if (alertData.severity === 'critical') {
    logger.info('Critical emergency alert - authorities should be notified', {
      incidentId: incident.id,
      userId,
      location: alertData.location,
    });
  }

  logger.info('Emergency alert triggered', {
    incidentId: incident.id,
    userId,
    alertType: alertData.alert_type,
    severity: alertData.severity,
  });

  res.status(201).json({
    success: true,
    message: 'Emergency alert triggered successfully',
    data: {
      incident_id: incident.id,
      alert_type: alertData.alert_type,
      severity: alertData.severity,
      status: 'active',
      tracking_session_id: alertData.severity === 'critical' || alertData.alert_type === 'panic_button' 
        ? `emergency_${incident.id}` : null,
      created_at: incident.created_at,
    },
  });
}));

// Start Live Tracking
app.post('/tracking/start', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { ride_id, emergency_id } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!ride_id && !emergency_id) {
    throw new ValidationError('Either ride_id or emergency_id is required');
  }

  // Verify ride or emergency belongs to user
  if (ride_id) {
    const { data: ride, error } = await supabase
      .from('rides')
      .select('id')
      .eq('id', ride_id)
      .or(`passenger_id.eq.${userId},driver_id.eq.${userId}`)
      .single();

    if (error || !ride) {
      throw new NotFoundError('Ride not found or access denied');
    }
  }

  if (emergency_id) {
    const { data: emergency, error } = await supabase
      .from('emergency_incidents')
      .select('id')
      .eq('id', emergency_id)
      .eq('user_id', userId)
      .single();

    if (error || !emergency) {
      throw new NotFoundError('Emergency incident not found or access denied');
    }
  }

  // Create tracking session
  const sessionId = ride_id ? `ride_${ride_id}` : `emergency_${emergency_id}`;
  
  activeTrackingSessions.set(sessionId, {
    userId,
    rideId: ride_id,
    emergencyId: emergency_id,
    connections: new Set(),
  });

  logger.info('Live tracking started', { sessionId, userId, rideId: ride_id, emergencyId: emergency_id });

  res.json({
    success: true,
    message: 'Live tracking started successfully',
    data: {
      session_id: sessionId,
      websocket_url: `ws://localhost:${process.env.EMERGENCY_WS_PORT || '3004'}`,
      started_at: new Date().toISOString(),
    },
  });
}));

// Update Location
app.post('/tracking/location', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { session_id, location }: { session_id: string; location: LocationUpdate } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!session_id || !location) {
    throw new ValidationError('session_id and location are required');
  }

  // Validate location data
  if (!location.latitude || !location.longitude) {
    throw new ValidationError('latitude and longitude are required');
  }

  // Verify session belongs to user
  const session = activeTrackingSessions.get(session_id);
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Tracking session not found or access denied');
  }

  // Update location in database if it's a ride
  if (session.rideId) {
    const { error } = await supabase
      .from('rides')
      .update({
        current_latitude: location.latitude,
        current_longitude: location.longitude,
        last_location_update: location.timestamp,
      })
      .eq('id', session.rideId);

    if (error) {
      logger.warn('Failed to update ride location', { error, rideId: session.rideId });
    }
  }

  // Broadcast location update to connected clients
  broadcastLocationUpdate(session_id, location);

  logger.debug('Location updated', { sessionId: session_id, userId, location });

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      session_id,
      timestamp: new Date().toISOString(),
    },
  });
}));

// Stop Live Tracking
app.post('/tracking/stop', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { session_id } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  if (!session_id) {
    throw new ValidationError('session_id is required');
  }

  // Verify session belongs to user
  const session = activeTrackingSessions.get(session_id);
  if (!session || session.userId !== userId) {
    throw new NotFoundError('Tracking session not found or access denied');
  }

  // Notify all connected clients that tracking has stopped
  const message = JSON.stringify({
    type: 'tracking_stopped',
    session_id,
    timestamp: new Date().toISOString(),
  });

  session.connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      ws.close();
    }
  });

  // Remove session
  activeTrackingSessions.delete(session_id);

  logger.info('Live tracking stopped', { sessionId: session_id, userId });

  res.json({
    success: true,
    message: 'Live tracking stopped successfully',
    data: {
      session_id,
      stopped_at: new Date().toISOString(),
    },
  });
}));

// Get Emergency Contacts
app.get('/contacts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const { data: contacts, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false });

  if (error) {
    throw new AppError('Failed to fetch emergency contacts', 500);
  }

  res.json({
    success: true,
    data: {
      contacts: contacts?.map(contact => ({
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        email: contact.email,
        relationship: contact.relationship,
        is_primary: contact.is_primary,
        created_at: contact.created_at,
      })) || [],
    },
  });
}));

// Add/Update Emergency Contact
app.post('/contacts', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const contactData: EmergencyContact = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  // Validate required fields
  if (!contactData.name || !contactData.phone || !contactData.relationship) {
    throw new ValidationError('name, phone, and relationship are required');
  }

  // If this is set as primary, unset other primary contacts
  if (contactData.is_primary) {
    await supabase
      .from('emergency_contacts')
      .update({ is_primary: false })
      .eq('user_id', userId);
  }

  const { data: contact, error } = await supabase
    .from('emergency_contacts')
    .insert({
      user_id: userId,
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email,
      relationship: contactData.relationship,
      is_primary: contactData.is_primary || false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to add emergency contact', 500);
  }

  logger.info('Emergency contact added', { userId, contactId: contact.id });

  res.status(201).json({
    success: true,
    message: 'Emergency contact added successfully',
    data: {
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      relationship: contact.relationship,
      is_primary: contact.is_primary,
      created_at: contact.created_at,
    },
  });
}));

// Delete Emergency Contact
app.delete('/contacts/:contactId', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { contactId } = req.params;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const { error } = await supabase
    .from('emergency_contacts')
    .delete()
    .eq('id', contactId)
    .eq('user_id', userId);

  if (error) {
    throw new AppError('Failed to delete emergency contact', 500);
  }

  logger.info('Emergency contact deleted', { userId, contactId });

  res.json({
    success: true,
    message: 'Emergency contact deleted successfully',
  });
}));

// Get Emergency Incidents
app.get('/incidents', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { page = 1, limit = 10, status } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  let query = supabase
    .from('emergency_incidents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + Number(limit) - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: incidents, error } = await query;

  if (error) {
    throw new AppError('Failed to fetch emergency incidents', 500);
  }

  res.json({
    success: true,
    data: {
      incidents: incidents?.map(incident => ({
        id: incident.id,
        ride_id: incident.ride_id,
        incident_type: incident.incident_type,
        description: incident.description,
        severity: incident.severity,
        status: incident.status,
        location: incident.location,
        created_at: incident.created_at,
        updated_at: incident.updated_at,
      })) || [],
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: incidents?.length || 0,
      },
    },
  });
}));

// Resolve Emergency Incident
app.patch('/incidents/:incidentId/resolve', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.id;
  const { incidentId } = req.params;
  const { resolution_notes } = req.body;

  if (!userId) {
    throw new ValidationError('User ID is required');
  }

  const { data: incident, error } = await supabase
    .from('emergency_incidents')
    .update({
      status: 'resolved',
      resolution_notes,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', incidentId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to resolve emergency incident', 500);
  }

  // Stop any active tracking sessions for this incident
  const sessionId = `emergency_${incidentId}`;
  if (activeTrackingSessions.has(sessionId)) {
    const session = activeTrackingSessions.get(sessionId)!;
    session.connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'incident_resolved',
          incident_id: incidentId,
          timestamp: new Date().toISOString(),
        }));
        ws.close();
      }
    });
    activeTrackingSessions.delete(sessionId);
  }

  logger.info('Emergency incident resolved', { incidentId, userId });

  res.json({
    success: true,
    message: 'Emergency incident resolved successfully',
    data: {
      incident_id: incidentId,
      status: 'resolved',
      resolved_at: incident.resolved_at,
    },
  });
}));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'emergency',
    active_sessions: activeTrackingSessions.size,
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Emergency service error', { error: error.message, stack: error.stack });
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

const PORT = process.env.EMERGENCY_PORT || 3005;

app.listen(PORT, () => {
  logger.info(`Emergency Service running on port ${PORT}`);
  logger.info(`WebSocket server running on port ${process.env.EMERGENCY_WS_PORT || '3004'}`);
});

export default app;