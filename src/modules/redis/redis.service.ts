import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// In-memory fallback for development without Redis
class InMemoryRedis {
  private store = new Map<string, { value: string; expiry?: number }>();
  private sets = new Map<string, Set<string>>();
  private hashes = new Map<string, Map<string, string>>();
  private geoData = new Map<string, Map<string, { lng: number; lat: number }>>();

  private isExpired(key: string): boolean {
    const item = this.store.get(key);
    if (item?.expiry && Date.now() > item.expiry) {
      this.store.delete(key);
      return true;
    }
    return false;
  }

  async setex(key: string, seconds: number, value: string) {
    this.store.set(key, { value, expiry: Date.now() + seconds * 1000 });
    return 'OK';
  }

  async get(key: string) {
    if (this.isExpired(key)) return null;
    return this.store.get(key)?.value || null;
  }

  async del(key: string) {
    this.store.delete(key);
    return 1;
  }

  async keys(pattern: string) {
    const prefix = pattern.replace('*', '');
    return Array.from(this.store.keys()).filter(k => k.startsWith(prefix));
  }

  async hset(key: string, field: string, value: string) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    this.hashes.get(key)!.set(field, value);
    return 1;
  }

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hdel(key: string, field: string) {
    this.hashes.get(key)?.delete(field);
    return 1;
  }

  async hgetall(key: string) {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  async sadd(key: string, ...members: string[]) {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    members.forEach(m => this.sets.get(key)!.add(m));
    return members.length;
  }

  async srem(key: string, member: string) {
    this.sets.get(key)?.delete(member);
    return 1;
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) || []);
  }

  async incr(key: string) {
    const current = parseInt(this.store.get(key)?.value || '0', 10);
    const newVal = current + 1;
    this.store.set(key, { value: String(newVal), expiry: this.store.get(key)?.expiry });
    return newVal;
  }

  async expire(key: string, seconds: number) {
    const item = this.store.get(key);
    if (item) {
      item.expiry = Date.now() + seconds * 1000;
    }
    return 1;
  }

  // GEO commands for in-memory fallback
  async geoadd(key: string, lng: number, lat: number, member: string) {
    if (!this.geoData.has(key)) this.geoData.set(key, new Map());
    this.geoData.get(key)!.set(member, { lng, lat });
    return 1;
  }

  async georadius(key: string, lng: number, lat: number, radius: number, unit: string, ...options: string[]) {
    const data = this.geoData.get(key);
    if (!data) return [];
    
    const radiusMeters = unit === 'km' ? radius * 1000 : radius;
    const results: any[] = [];
    
    for (const [member, coords] of data.entries()) {
      const distance = this.haversineDistance(lat, lng, coords.lat, coords.lng);
      if (distance <= radiusMeters) {
        const distKm = distance / 1000;
        results.push([member, distKm.toFixed(4), [coords.lng.toString(), coords.lat.toString()]]);
      }
    }
    
    // Sort by distance
    results.sort((a, b) => parseFloat(a[1]) - parseFloat(b[1]));
    return results;
  }

  async zrem(key: string, member: string) {
    const data = this.geoData.get(key);
    if (data) data.delete(member);
    return 1;
  }

  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  pipeline() {
    const commands: Array<{ method: string; args: any[] }> = [];
    const self = this;
    return {
      smembers(key: string) {
        commands.push({ method: 'smembers', args: [key] });
        return this;
      },
      async exec() {
        const results: Array<[null, any]> = [];
        for (const cmd of commands) {
          const result = await (self as any)[cmd.method](...cmd.args);
          results.push([null, result]);
        }
        return results;
      }
    };
  }

  async quit() { return 'OK'; }
  on(event: string, callback: Function) {}
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | InMemoryRedis;
  private readonly logger = new Logger(RedisService.name);
  private useInMemory = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const useInMemoryConfig = this.configService.get('REDIS_USE_MEMORY') === 'true';
    
    if (useInMemoryConfig) {
      this.logger.warn('🟡 Using in-memory Redis fallback (REDIS_USE_MEMORY=true)');
      this.client = new InMemoryRedis() as any;
      this.useInMemory = true;
      return;
    }

    try {
      // Support both REDIS_URL and individual config
      const redisUrl = this.configService.get('REDIS_URL');
      
      if (redisUrl) {
        this.client = new Redis(redisUrl, {
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('🟡 Redis unavailable, switching to in-memory fallback');
              this.client = new InMemoryRedis() as any;
              this.useInMemory = true;
              return null;
            }
            return Math.min(times * 100, 3000);
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });
      } else {
        this.client = new Redis({
          host: this.configService.get('REDIS_HOST') || 'localhost',
          port: this.configService.get('REDIS_PORT') || 6379,
          password: this.configService.get('REDIS_PASSWORD') || undefined,
          retryStrategy: (times) => {
            if (times > 3) {
              this.logger.warn('🟡 Redis unavailable, switching to in-memory fallback');
              this.client = new InMemoryRedis() as any;
              this.useInMemory = true;
              return null;
            }
            return Math.min(times * 100, 3000);
          },
        });
      }

      this.client.on('error', (err) => {
        if (!this.useInMemory) {
          this.logger.error('Redis connection error:', err.message);
        }
      });

      this.client.on('connect', () => {
        this.logger.log('🔴 Redis connected');
      });

      // Test connection
      await this.client.ping();
    } catch (error) {
      this.logger.warn('🟡 Redis unavailable, using in-memory fallback');
      this.client = new InMemoryRedis() as any;
      this.useInMemory = true;
    }
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  getClient(): Redis {
    return this.client as Redis;
  }

  // Presence operations
  async setUserPresence(userId: string, data: object, ttlSeconds = 60): Promise<void> {
    const key = `presence:${userId}`;
    await this.client.setex(key, ttlSeconds, JSON.stringify(data));
  }

  async getUserPresence(userId: string): Promise<object | null> {
    const key = `presence:${userId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async removeUserPresence(userId: string): Promise<void> {
    const key = `presence:${userId}`;
    await this.client.del(key);
  }

  async getAllLiveUsers(): Promise<string[]> {
    const keys = await this.client.keys('presence:*');
    return keys.map((key) => key.replace('presence:', ''));
  }

  // Geolocation operations (for nearby users)
  async setUserLocation(userId: string, geohash: string): Promise<void> {
    await this.client.hset('user:locations', userId, geohash);
    await this.client.sadd(`geohash:${geohash}`, userId);
  }

  async removeUserLocation(userId: string, oldGeohash?: string): Promise<void> {
    if (oldGeohash) {
      await this.client.srem(`geohash:${oldGeohash}`, userId);
    }
    await this.client.hdel('user:locations', userId);
  }

  async getUsersInGeohash(geohash: string): Promise<string[]> {
    return this.client.smembers(`geohash:${geohash}`);
  }

  async getUsersInGeohashes(geohashes: string[]): Promise<string[]> {
    const pipeline = this.client.pipeline();
    geohashes.forEach((gh) => pipeline.smembers(`geohash:${gh}`));
    const results = await pipeline.exec();
    
    const users: string[] = [];
    results?.forEach((result) => {
      if (result[1]) {
        users.push(...(result[1] as string[]));
      }
    });
    return [...new Set(users)];
  }

  // Rate limiting
  async incrementRateLimit(key: string, windowSeconds: number): Promise<number> {
    const current = await this.client.incr(key);
    if (current === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return current;
  }

  async getRateLimit(key: string): Promise<number> {
    const count = await this.client.get(key);
    return count ? parseInt(count, 10) : 0;
  }

  // Find session tracking
  async setFindSession(sessionId: string, data: object, ttlSeconds = 300): Promise<void> {
    const key = `find:${sessionId}`;
    await this.client.setex(key, ttlSeconds, JSON.stringify(data));
  }

  async getFindSession(sessionId: string): Promise<object | null> {
    const key = `find:${sessionId}`;
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }

  async deleteFindSession(sessionId: string): Promise<void> {
    const key = `find:${sessionId}`;
    await this.client.del(key);
  }

  // WebSocket connection tracking
  async addSocketConnection(userId: string, socketId: string): Promise<void> {
    await this.client.hset('socket:connections', userId, socketId);
  }

  async removeSocketConnection(userId: string): Promise<void> {
    await this.client.hdel('socket:connections', userId);
  }

  async getSocketId(userId: string): Promise<string | null> {
    return this.client.hget('socket:connections', userId);
  }

  async getAllConnectedUsers(): Promise<string[]> {
    const connections = await this.client.hgetall('socket:connections');
    return Object.keys(connections);
  }

  // GEO operations for Redis GEO
  async geoAdd(key: string, lng: number, lat: number, member: string): Promise<number> {
    return this.client.geoadd(key, lng, lat, member);
  }

  async geoRadius(
    key: string,
    lng: number,
    lat: number,
    radius: number,
    unit: 'km' | 'm' = 'km',
    options: { withDist?: boolean; withCoord?: boolean; count?: number; sort?: 'ASC' | 'DESC' } = {}
  ): Promise<any[]> {
    const args: (string | number)[] = [key, lng, lat, radius, unit];
    if (options.withDist) args.push('WITHDIST');
    if (options.withCoord) args.push('WITHCOORD');
    if (options.sort) args.push(options.sort);
    if (options.count) args.push('COUNT', options.count);
    return (this.client as any).georadius(...args);
  }

  async geoRemove(key: string, member: string): Promise<number> {
    return (this.client as any).zrem(key, member);
  }
}
