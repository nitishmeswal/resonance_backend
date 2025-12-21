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

export type ReactionType = 'fire' | 'heart' | 'music' | 'wave' | 'sparkle';

@Entity('reactions')
@Index(['receiverId', 'createdAt'])
@Index(['senderId', 'receiverId', 'type'], { unique: true })
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'receiver_id' })
  receiverId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receiver_id' })
  receiver: User;

  @Column({ type: 'varchar', length: 20 })
  type: ReactionType;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
