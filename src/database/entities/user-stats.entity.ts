import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_stats')
export class UserStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'tracks_shared', default: 0 })
  tracksShared: number;

  @Column({ name: 'connections_made', default: 0 })
  connectionsMade: number;

  @Column({ name: 'total_matches', default: 0 })
  totalMatches: number;

  @Column({ name: 'find_sessions_completed', default: 0 })
  findSessionsCompleted: number;

  @Column({ name: 'reactions_sent', default: 0 })
  reactionsSent: number;

  @Column({ name: 'reactions_received', default: 0 })
  reactionsReceived: number;

  @Column({ name: 'total_listen_time_minutes', default: 0 })
  totalListenTimeMinutes: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
