import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum FindSessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum DistanceBucket {
  FAR = 'far',
  WARM = 'warm',
  CLOSE = 'close',
  FOUND = 'found',
}

@Entity('find_sessions')
export class FindSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'seeker_id' })
  seekerId: string;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  @Column({
    type: 'enum',
    enum: FindSessionStatus,
    default: FindSessionStatus.ACTIVE,
  })
  status: FindSessionStatus;

  @Column({
    type: 'enum',
    enum: DistanceBucket,
    default: DistanceBucket.FAR,
    name: 'current_bucket',
  })
  currentBucket: DistanceBucket;

  @CreateDateColumn({ name: 'started_at' })
  startedAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'ended_at' })
  endedAt: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'seeker_id' })
  seeker: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target: User;
}
