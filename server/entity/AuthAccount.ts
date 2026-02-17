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

@Entity('auth_account')
@Index('auth_account_userId_idx', ['userId'])
export class AuthAccount {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar', name: 'account_id' })
  accountId: string;

  @Column({ type: 'varchar', name: 'provider_id' })
  providerId: string;

  @Column({ type: 'varchar', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'access_token', nullable: true })
  accessToken: string | null;

  @Column({ type: 'varchar', name: 'refresh_token', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'varchar', name: 'id_token', nullable: true })
  idToken: string | null;

  @DbAwareColumn({
    type: 'datetime',
    name: 'access_token_expires_at',
    nullable: true,
  })
  accessTokenExpiresAt: Date | null;

  @DbAwareColumn({
    type: 'datetime',
    name: 'refresh_token_expires_at',
    nullable: true,
  })
  refreshTokenExpiresAt: Date | null;

  @Column({ type: 'varchar', name: 'scope', nullable: true })
  scope: string | null;

  @Column({ type: 'varchar', name: 'password', nullable: true })
  password: string | null;

  @DbAwareColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => AuthUser, (u) => u.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: AuthUser;
}
