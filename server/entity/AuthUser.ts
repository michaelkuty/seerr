import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { AuthAccount } from './AuthAccount';
import { AuthSession } from './AuthSession';

@Entity('auth_user')
export class AuthUser {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar', name: 'name' })
  name: string;

  @Column({ type: 'varchar', name: 'email', unique: true })
  email: string;

  @Column({ type: 'boolean', name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', name: 'image', nullable: true })
  image: string | null;

  @DbAwareColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => AuthSession, (s) => s.user)
  sessions?: AuthSession[];

  @OneToMany(() => AuthAccount, (a) => a.user)
  accounts?: AuthAccount[];
}
