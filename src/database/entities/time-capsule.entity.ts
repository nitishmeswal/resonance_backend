import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export type CapsuleVisibility = 'public' | 'friends' | 'private';

@Entity('time_capsules')
export class TimeCapsule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'creator_id' })
  creatorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  // Location (geohash for privacy)
  @Column({ length: 12 })
  geohash: string;

  @Column({ name: 'location_name', type: 'varchar', length: 255, nullable: true })
  locationName: string | null; // "Central Park", "My favorite café"

  // The song dropped
  @Column({ name: 'track_id', length: 255 })
  trackId: string;

  @Column({ name: 'track_name', length: 500 })
  trackName: string;

  @Column({ length: 500 })
  artist: string;

  @Column({ name: 'album_art', type: 'text', nullable: true })
  albumArt: string | null;

  @Column({ name: 'preview_url', type: 'text', nullable: true })
  previewUrl: string | null;

  // Capsule content
  @Column({ type: 'text', nullable: true })
  message: string | null; // Personal note attached to the drop

  @Column({ type: 'varchar', length: 50, nullable: true })
  mood: string | null; // 'nostalgic', 'happy', 'melancholic', etc.

  // Visibility & timing
  @Column({ type: 'varchar', length: 20, default: 'public' })
  visibility: CapsuleVisibility;

  @Column({ name: 'unlock_at', type: 'timestamp with time zone', nullable: true })
  unlockAt: Date | null; // Future unlock date (time capsule aspect)

  @Column({ name: 'expires_at', type: 'timestamp with time zone', nullable: true })
  expiresAt: Date | null; // When it disappears

  // Discovery settings
  @Column({ name: 'discovery_radius_meters', type: 'int', default: 100 })
  discoveryRadiusMeters: number; // How close you need to be

  @Column({ name: 'max_discoveries', type: 'int', nullable: true })
  maxDiscoveries: number | null; // Limit how many can find it

  // Stats
  @Column({ name: 'discovery_count', type: 'int', default: 0 })
  discoveryCount: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
