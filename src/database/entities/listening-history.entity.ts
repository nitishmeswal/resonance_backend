import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('listening_history')
@Index(['userId', 'playedAt'])
export class ListeningHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'track_id', type: 'varchar', length: 255 })
  trackId: string;

  @Column({ name: 'track_name', type: 'varchar', length: 500 })
  trackName: string;

  @Column({ type: 'varchar', length: 500 })
  artist: string;

  @Column({ name: 'album_art', type: 'text', nullable: true })
  albumArt: string | null;

  @Column({ name: 'played_at', type: 'timestamp with time zone' })
  playedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
