import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { TimeCapsule } from './time-capsule.entity';

@Entity('capsule_discoveries')
@Unique(['capsuleId', 'userId'])
export class CapsuleDiscovery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'capsule_id' })
  capsuleId: string;

  @ManyToOne(() => TimeCapsule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'capsule_id' })
  capsule: TimeCapsule;

  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'discovered_at_geohash', length: 12 })
  discoveredAtGeohash: string;

  @Column({ name: 'has_liked', default: false })
  hasLiked: boolean;

  @CreateDateColumn({ name: 'discovered_at' })
  discoveredAt: Date;
}
