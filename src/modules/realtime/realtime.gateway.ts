import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UseGuards } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

import { RealtimeService } from './realtime.service';
import { RedisService } from '../redis/redis.service';
import { PresenceService } from '../presence/presence.service';
import { LocationService } from '../location/location.service';
import { FindService } from '../find/find.service';
import { GeoService } from '../geo/geo.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private realtimeService: RealtimeService,
    private redisService: RedisService,
    private presenceService: PresenceService,
    private locationService: LocationService,
    private findService: FindService,
    private jwtService: JwtService,
    private geoService: GeoService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn('Connection rejected: No token provided');
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;

      if (!client.userId) {
        this.logger.warn('Connection rejected: No user ID in token');
        client.disconnect();
        return;
      }

      // Track socket connection
      await this.redisService.addSocketConnection(client.userId, client.id);
      
      // Join user's personal room
      client.join(`user:${client.userId}`);

      this.logger.log(`Client connected: ${client.userId}`);
      
      // Send current state
      client.emit('connected', { userId: client.userId });
    } catch (error) {
      this.logger.warn('Connection rejected: Invalid token');
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      await this.redisService.removeSocketConnection(client.userId);
      this.logger.log(`Client disconnected: ${client.userId}`);
    }
  }

  // User goes live
  @SubscribeMessage('user:go_live')
  async handleGoLive(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return;

    const status = await this.presenceService.goLive(client.userId);
    
    // Join the live users room
    client.join('live_users');
    
    // Broadcast to nearby users
    await this.broadcastToNearbyUsers(client.userId, 'live:user_joined', {
      userId: client.userId,
    });

    return { success: true, status };
  }

  // User goes offline
  @SubscribeMessage('user:go_offline')
  async handleGoOffline(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return;

    const status = await this.presenceService.goOffline(client.userId);
    
    // Leave the live users room
    client.leave('live_users');
    
    // Broadcast to nearby users
    await this.broadcastToNearbyUsers(client.userId, 'live:user_left', {
      userId: client.userId,
    });

    return { success: true, status };
  }

  // Update current track
  @SubscribeMessage('user:update_track')
  async handleUpdateTrack(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { trackId: string; trackName: string; artist: string; albumArt?: string },
  ) {
    if (!client.userId) return;

    // Broadcast track update to nearby users
    await this.broadcastToNearbyUsers(client.userId, 'live:track_update', {
      userId: client.userId,
      ...data,
    });

    return { success: true };
  }

  // Update location (legacy geohash method)
  @SubscribeMessage('user:update_location')
  async handleUpdateLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { geohash: string; precisionLevel?: number },
  ) {
    if (!client.userId) return;

    await this.locationService.updateLocation(
      client.userId,
      data.geohash,
      data.precisionLevel,
    );

    // Get nearby users and send them to this client
    const nearbyUsers = await this.locationService.getNearbyUsers(client.userId);
    client.emit('live:nearby_users', { users: nearbyUsers });

    return { success: true };
  }

  // Update location with lat/lng (NEW - uses Redis GEO for O(log n) lookup)
  @SubscribeMessage('user:update_location_geo')
  async handleUpdateLocationGeo(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { latitude: number; longitude: number; radiusKm?: number },
  ) {
    if (!client.userId) return;

    // Store in Redis GEO for fast lookup
    await this.geoService.setUserLocation(client.userId, data.latitude, data.longitude);

    // Get nearby users with full details including bearing
    const nearbyUsers = await this.geoService.getNearbyUsersWithDetails(
      client.userId,
      data.latitude,
      data.longitude,
      data.radiusKm || 5
    );

    // Send to client with bearing data for proper map positioning
    client.emit('live:nearby_users_geo', { 
      users: nearbyUsers,
      timestamp: Date.now()
    });

    this.logger.debug(`Location update for ${client.userId}: ${nearbyUsers.length} nearby users found`);

    return { success: true, nearbyCount: nearbyUsers.length };
  }

  // Send reaction to another user (real-time delivery)
  @SubscribeMessage('reaction:send')
  async handleSendReaction(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetUserId: string; reactionType: string },
  ) {
    if (!client.userId) return;

    this.logger.log(`Reaction from ${client.userId} to ${data.targetUserId}: ${data.reactionType}`);

    // Emit to target user immediately
    this.server.to(`user:${data.targetUserId}`).emit('reaction:received', {
      senderId: client.userId,
      type: data.reactionType,
      timestamp: Date.now(),
    });

    // Also emit to sender for confirmation
    client.emit('reaction:sent', {
      targetUserId: data.targetUserId,
      type: data.reactionType,
      timestamp: Date.now(),
    });

    return { success: true };
  }

  // Heartbeat to maintain presence
  @SubscribeMessage('user:heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) return;

    await this.presenceService.heartbeat(client.userId);
    return { success: true };
  }

  // Start Find session
  @SubscribeMessage('find:start')
  async handleStartFind(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { targetId: string },
  ) {
    if (!client.userId) return;

    try {
      const session = await this.findService.startFindSession(client.userId, data.targetId);
      
      // Notify target user
      this.server.to(`user:${data.targetId}`).emit('find:request_received', {
        sessionId: session.sessionId,
        seekerId: client.userId,
      });

      return { success: true, session };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Update Find session location
  @SubscribeMessage('find:update_location')
  async handleFindUpdateLocation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string; geohash: string },
  ) {
    if (!client.userId) return;

    // Update location first
    await this.locationService.updateLocation(client.userId, data.geohash);

    // Get updated bucket
    const bucket = await this.findService.updateSessionBucket(data.sessionId);

    // Emit to both seeker and target
    const session = await this.findService.getSessionById(data.sessionId);
    if (session) {
      this.server.to(`user:${session.seekerId}`).emit('find:bucket_update', {
        sessionId: data.sessionId,
        bucket,
      });
      this.server.to(`user:${session.targetId}`).emit('find:bucket_update', {
        sessionId: data.sessionId,
        bucket,
      });
    }

    return { success: true, bucket };
  }

  // End Find session
  @SubscribeMessage('find:end')
  async handleEndFind(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { sessionId: string; completed: boolean },
  ) {
    if (!client.userId) return;

    const status = data.completed ? 'completed' : 'cancelled';
    await this.findService.endSession(data.sessionId, client.userId, status as any);

    // Notify both users
    const session = await this.findService.getSessionById(data.sessionId);
    if (session) {
      const eventData = { sessionId: data.sessionId, status };
      this.server.to(`user:${session.seekerId}`).emit('find:session_ended', eventData);
      this.server.to(`user:${session.targetId}`).emit('find:session_ended', eventData);
    }

    return { success: true };
  }

  // Helper to broadcast to nearby users
  private async broadcastToNearbyUsers(userId: string, event: string, data: any) {
    const nearbyUsers = await this.locationService.getNearbyUsers(userId);
    
    for (const user of nearbyUsers) {
      this.server.to(`user:${user.userId}`).emit(event, data);
    }
  }

  // Public method to emit to a specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // Public method to emit to all live users
  emitToLiveUsers(event: string, data: any) {
    this.server.to('live_users').emit(event, data);
  }
}
