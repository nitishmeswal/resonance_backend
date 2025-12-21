import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { SpotifyToken } from './spotify-token.entity';
import { LiveStatus } from './live-status.entity';
import { CurrentTrack } from './current-track.entity';
import { LocationSnapshot } from './location-snapshot.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', unique: true, name: 'spotify_id' })
  spotifyId: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName: string;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: false, name: 'is_anonymous' })
  isAnonymous: boolean;

  @Column({ name: 'instagram_handle', type: 'varchar', length: 100, nullable: true })
  instagramHandle: string | null;

  @Column({ name: 'discord_handle', type: 'varchar', length: 100, nullable: true })
  discordHandle: string | null;

  @Column({ name: 'radius_km', type: 'float', default: 5 })
  radiusKm: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => SpotifyToken, (token) => token.user)
  spotifyToken: SpotifyToken;

  @OneToOne(() => LiveStatus, (status) => status.user)
  liveStatus: LiveStatus;

  @OneToOne(() => CurrentTrack, (track) => track.user)
  currentTrack: CurrentTrack;

  @OneToOne(() => LocationSnapshot, (location) => location.user)
  locationSnapshot: LocationSnapshot;
}
