# SafeRide Backend API

A decentralized ride-sharing platform backend built with Node.js, Express, TypeScript, and BlockDAG blockchain integration.

## 🏗️ Architecture

SafeRide follows a microservices architecture with the following components:

- **API Gateway** (Port 3000) - Main entry point, authentication, and request routing
- **Driver Verification Service** (Port 3002) - Driver registration, document verification, and blockchain verification
- **Passenger Management Service** (Port 3003) - Passenger profiles, ride history, and safety reports
- **Emergency Service** (Port 3005) - Panic button, live tracking, and emergency notifications
- **Ride Booking Service** (Port 3006) - Ride requests, matching, and completion with blockchain escrow

## 🚀 Features

### Core Features
- **Decentralized Identity**: Blockchain-based driver verification
- **Smart Escrow**: Automated payment handling via smart contracts
- **Real-time Tracking**: Live location updates during rides and emergencies
- **Emergency System**: Panic button with instant notifications
- **Privacy-First**: Anonymized data handling and GDPR compliance
- **Multi-layer Security**: JWT authentication, rate limiting, and input validation

### Technical Features
- Microservices architecture
- TypeScript for type safety
- Supabase for database and storage
- BlockDAG blockchain integration
- WebSocket for real-time communication
- Docker containerization
- Nginx reverse proxy
- Comprehensive logging and monitoring

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Docker and Docker Compose (for containerized deployment)
- Supabase account and project
- BlockDAG wallet and RPC access
- Twilio account (for SMS notifications)
- SendGrid account (for email notifications)

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd saferide-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here

# BlockDAG Configuration
BLOCKDAG_RPC_URL=https://rpc.blockdag.network
BLOCKDAG_PRIVATE_KEY=your_blockdag_private_key
ESCROW_CONTRACT_ADDRESS=0x...
DRIVER_VERIFICATION_CONTRACT_ADDRESS=0x...

# Notification Services
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### 4. Database Setup

The database schema is automatically created when you first run the application. Ensure your Supabase project is properly configured with the required tables.

### 5. Build the Application
```bash
npm run build
```

## 🚀 Running the Application

### Development Mode
```bash
# Start all services in development mode
npm run dev

# Or start individual services
npm run dev:gateway
npm run dev:driver-verification
npm run dev:passenger-management
npm run dev:emergency
npm run dev:ride-booking
```

### Production Mode
```bash
# Build and start
npm run build
npm start
```

### Docker Deployment
```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/password` - Change password

### Driver Endpoints
- `POST /api/drivers/register` - Driver registration
- `POST /api/drivers/documents/upload` - Upload verification documents
- `GET /api/drivers/status` - Get driver verification status
- `PUT /api/drivers/availability` - Update driver availability
- `POST /api/drivers/admin/verify/:driverId` - Admin: Verify driver
- `GET /api/drivers/admin/pending` - Admin: Get pending verifications

### Passenger Endpoints
- `GET /api/passengers/profile` - Get passenger profile
- `PUT /api/passengers/profile` - Update passenger profile
- `GET /api/passengers/rides/history` - Get ride history
- `GET /api/passengers/rides/stats` - Get ride statistics
- `POST /api/passengers/safety/report` - Submit safety report
- `PUT /api/passengers/preferences` - Update preferences

### Ride Endpoints
- `POST /api/rides/request` - Request a ride
- `POST /api/rides/:rideId/accept` - Accept a ride (driver)
- `POST /api/rides/:rideId/start` - Start a ride (driver)
- `PUT /api/rides/:rideId/location` - Update ride location
- `POST /api/rides/:rideId/complete` - Complete a ride
- `POST /api/rides/:rideId/cancel` - Cancel a ride
- `POST /api/rides/:rideId/rate` - Rate a ride
- `GET /api/rides/:rideId` - Get ride details
- `GET /api/rides/active` - Get active rides

### Emergency Endpoints
- `POST /api/emergency/alert` - Trigger emergency alert
- `POST /api/emergency/tracking/start` - Start live tracking
- `PUT /api/emergency/tracking/location` - Update location
- `POST /api/emergency/tracking/stop` - Stop tracking
- `GET /api/emergency/contacts` - Get emergency contacts
- `POST /api/emergency/contacts` - Add emergency contact
- `DELETE /api/emergency/contacts/:contactId` - Delete emergency contact

## 🔧 Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | Yes |
| `BLOCKDAG_RPC_URL` | BlockDAG RPC endpoint | Yes |
| `BLOCKDAG_PRIVATE_KEY` | BlockDAG wallet private key | Yes |
| `ESCROW_CONTRACT_ADDRESS` | Smart contract address for escrow | Yes |
| `DRIVER_VERIFICATION_CONTRACT_ADDRESS` | Smart contract for driver verification | Yes |
| `TWILIO_ACCOUNT_SID` | Twilio account SID | No |
| `TWILIO_AUTH_TOKEN` | Twilio auth token | No |
| `SENDGRID_API_KEY` | SendGrid API key | No |

### Port Configuration

- API Gateway: 3000
- Driver Verification: 3002
- Passenger Management: 3003
- Emergency WebSocket: 3004
- Emergency HTTP: 3005
- Ride Booking: 3006

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test:unit
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

## 📊 Monitoring and Logging

### Health Checks
- Main health endpoint: `GET /health`
- Individual service health: `GET /api/{service}/health`

### Logging
- Application logs: `./logs/app.log`
- Error logs: `./logs/error.log`
- Access logs: `./logs/access.log`

### Metrics
- Request/response times
- Error rates
- Active connections
- Database query performance

## 🔒 Security

### Authentication
- JWT-based authentication
- Refresh token rotation
- Role-based access control

### Security Headers
- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation and sanitization

### Data Protection
- Encrypted sensitive data
- Anonymized location data
- GDPR compliance features
- Secure file upload handling

## 🚀 Deployment

### Docker Deployment
1. Configure environment variables
2. Build and deploy: `docker-compose up -d`
3. Monitor logs: `docker-compose logs -f`

### Production Considerations
- Use HTTPS in production
- Configure proper CORS origins
- Set up monitoring and alerting
- Regular security updates
- Database backups
- Load balancing for high availability

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

## 🔄 Version History

- **v1.0.0** - Initial release with core functionality
  - Microservices architecture
  - BlockDAG integration
  - Emergency system
  - Driver verification
  - Ride booking and management

---

**SafeRide** - Decentralized, secure, and privacy-focused ride-sharing platform.