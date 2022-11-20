import { Entity, Column, PrimaryColumn } from 'typeorm'

@Entity()
export class Metadata {
  @PrimaryColumn()
  id!: number

  @Column({ nullable: true })
  name?: string

  @Column({ type: 'longtext' })
  description?: string

  @Column({ nullable: true })
  image?: string

  @Column({ nullable: true })
  type?: string

  @Column({ nullable: true })
  file?: string

  @Column({ type: 'json', nullable: true })
  metadata?: string
}
