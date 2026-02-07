const { createClient } = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.connectionTime = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async initialize() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const redisPassword = process.env.REDIS_PASSWORD;

      console.log(`🔗 Connecting to Redis: ${redisUrl}`);

      const options = {
        url: redisUrl,
        password: redisPassword,
        socket: {
          reconnectStrategy: (retries) => {
            this.reconnectAttempts = retries;
            if (retries >= this.maxReconnectAttempts) {
              console.error('❌ Max Redis reconnection attempts reached');
              return false;
            }
            const delay = Math.min(retries * 100, 2000);
            console.log(`🔄 Redis reconnection attempt ${retries + 1}, next try in ${delay}ms`);
            return delay;
          }
        }
      };

      this.client = createClient(options);

      // Event listeners
      this.client.on('connect', () => console.log('✅ Redis connected'));
      this.client.on('ready', () => {
        console.log('⚡ Redis ready');
        this.connectionTime = new Date();
        this.reconnectAttempts = 0;
      });
      this.client.on('error', (err) => console.error(`❌ Redis error: ${err.message}`));
      this.client.on('end', () => console.log('🔌 Redis disconnected'));

      await this.client.connect();

      const ping = await this.client.ping();
      console.log(`🎯 Redis connection test successful: ${ping}`);

      return this.client;
    } catch (error) {
      console.error(`❌ Redis initialization failed: ${error.message}`);
      console.log('⚠️  Running in fallback mode (mock client)');

      this.client = this.createMockClient();
      return this.client;
    }
  }

  /** 
   * This is the method BullMQ expects to get a connection object
   */
  getBullConnection() {
    if (!this.client || this.client.isMock) return null;

    // BullMQ can use the same node-redis client
    return this.client;
  }

  createMockClient() {
    return {
      isMock: true,
      get: async () => null,
      set: async () => false,
      setEx: async () => false,
      del: async () => false,
      quit: async () => true,
      ping: async () => 'PONG (mock)',
      on: () => {}
    };
  }

  // Convenience methods (get, set, del...) stay the same
  async get(key) { if (!this.client || this.client.isMock) return null; try { return await this.client.get(key); } catch (e) { return null; } }
  async set(key, value, ttl = null) { if (!this.client || this.client.isMock) return false; try { if (ttl) await this.client.setEx(key, ttl, value); else await this.client.set(key, value); return true; } catch (e) { return false; } }
  async del(key) { if (!this.client || this.client.isMock) return false; try { await this.client.del(key); return true; } catch (e) { return false; } }

  async disconnect() {
    if (this.client && !this.client.isMock) {
      try { await this.client.quit(); console.log('👋 Redis disconnected gracefully'); } 
      catch (error) { console.error('Error disconnecting Redis:', error.message); }
    }
  }
}

module.exports = new RedisClient();
