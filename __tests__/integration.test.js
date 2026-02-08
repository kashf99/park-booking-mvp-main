/**
 * Integration smoke tests for key endpoints.
 * Requires a reachable MongoDB. Default connects to local docker mongo.
 * Set TEST_MONGODB_URI to point elsewhere if needed.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Attraction = require('../src/models/Attraction');
const User = require('../src/models/User');

const TEST_DB =
  process.env.TEST_MONGODB_URI ||
  'mongodb://mongo:27017/park-booking-test';

describe('API integration', () => {
  beforeAll(async () => {
    await mongoose.connect(TEST_DB, {
      serverSelectionTimeoutMS: 5000,
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  });

  describe('Health', () => {
    it('returns healthy status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('service', 'Park Booking API');
    });
  });

  describe('Users', () => {
    it('creates and logs in a user', async () => {
      const email = `test+${Date.now()}@example.com`;
      const password = 'StrongPass123!';

      const createRes = await request(app)
        .post('/api/users')
        .send({
          name: 'Test User',
          email,
          password,
          role: 'admin',
        });
      expect(createRes.status).toBe(201);

      const loginRes = await request(app)
        .post('/api/users/login')
        .send({ email, password });
      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty('token');
      expect(loginRes.body.user.email).toBe(email);
    });
  });

  describe('Attractions', () => {
    beforeAll(async () => {
      await Attraction.deleteMany({});
      await Attraction.create([
        {
          name: 'Active Ride',
          ticketPrice: 10,
          capacityPerSlot: 50,
          isActive: true,
        },
        {
          name: 'Closed Ride',
          ticketPrice: 12,
          capacityPerSlot: 40,
          isActive: false,
        },
      ]);
    });

    it('returns only active attractions by default', async () => {
      const res = await request(app).get('/api/attractions');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const names = res.body.data.map((a) => a.name);
      expect(names).toContain('Active Ride');
      expect(names).not.toContain('Closed Ride');
    });

    it('returns inactive attractions when requested', async () => {
      const res = await request(app).get('/api/attractions?isActive=false');
      expect(res.status).toBe(200);
      const names = res.body.data.map((a) => a.name);
      expect(names).toContain('Closed Ride');
    });
  });
});
