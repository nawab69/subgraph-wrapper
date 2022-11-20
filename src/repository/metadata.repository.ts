import { AppDataSource } from '../dataSource'
import { Metadata } from '../entity/metadata.entity'

export const metadataRepository = AppDataSource.getRepository(Metadata)
