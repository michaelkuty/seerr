import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { AuthUser } from './AuthUser';

@Entity('auth_session')
@Index('auth_session_userId_idx', ['userId'])
export class AuthSession {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @DbAwareColumn({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', name: 'token', unique: true })
  token: string;

  @DbAwareColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'varchar', name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', name: 'user_id' })
  userId: string;

  @ManyToOne(() => AuthUser, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: AuthUser;
}
