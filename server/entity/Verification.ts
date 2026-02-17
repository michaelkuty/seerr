import { DbAwareColumn } from '@server/utils/DbColumnHelper';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('verification')
@Index('verification_identifier_idx', ['identifier'])
export class Verification {
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @Column({ type: 'varchar', name: 'identifier' })
  identifier: string;

  @Column({ type: 'varchar', name: 'value' })
  value: string;

  @DbAwareColumn({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @DbAwareColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
