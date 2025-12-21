import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('live_status')
export class LiveStatus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'boolean', default: false, name: 'is_live' })
  isLive: boolean;

  @Column({ type: 'boolean', default: false, name: 'share_track' })
  shareTrack: boolean;

  @Column({ type: 'boolean', default: false, name: 'allow_find' })
  allowFind: boolean;

  @Column({ type: 'int', default: 5, name: 'radius_km' })
  radiusKm: number;

  @Column({ type: 'timestamp', nullable: true, name: 'last_active' })
  lastActive: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.liveStatus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
