import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './User';

/**
 * Stores OIDC provider link and tokens for a Seerr user.
 * Used for refresh and listing linked accounts.
 */
@Entity('oidc_account')
@Index('oidc_account_userId_idx', ['userId'])
@Index('oidc_account_issuer_sub_idx', ['issuer', 'sub'])
export class OidcAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'integer', name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', name: 'issuer' })
  issuer: string;

  @Column({ type: 'varchar', name: 'sub' })
  sub: string;

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

  @DbAwareColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
