import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('current_tracks')
export class CurrentTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'text', name: 'track_id' })
  trackId: string;

  @Column({ type: 'text', name: 'track_name' })
  trackName: string;

  @Column({ type: 'text' })
  artist: string;

  @Column({ type: 'text', nullable: true, name: 'album_art' })
  albumArt: string | null;

  @Column({ type: 'float', nullable: true })
  energy: number | null;

  @Column({ type: 'float', nullable: true })
  tempo: number | null;

  @Column({ type: 'float', nullable: true })
  valence: number | null;

  @Column({ type: 'boolean', default: false, name: 'is_playing' })
  isPlaying: boolean;

  @Column({ type: 'int', default: 0, name: 'progress_ms' })
  progressMs: number;

  @Column({ type: 'int', default: 0, name: 'duration_ms' })
  durationMs: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.currentTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
