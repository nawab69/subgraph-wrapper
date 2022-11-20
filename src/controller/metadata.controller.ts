import { Metadata } from '../entity/metadata.entity'
import { metadataRepository } from '../repository/metadata.repository'
import axios from 'axios'

export async function getMetadataByID(id: number): Promise<Metadata | null> {
  return await metadataRepository.findOne({ where: { id: id } })
}

export async function getMetadataByTokenURI(
  id: number,
  tokenURI: string
): Promise<Metadata | null> {
  try {
    // Fetch axios
    const response = await axios.get(tokenURI)
    const data = response.data
    // Create metadata
    const metadata = new Metadata()
    metadata.id = id
    metadata.name = data?.name || data?.title || 'Unnamed'
    metadata.description =
      data?.description || data?.subtitle || 'No description'
    metadata.image = data?.image || data?.image_url || null
    metadata.type = data?.type || 'image'
    metadata.file = data?.file || null
    metadata.metadata = JSON.stringify(data)
    const createdMetadata = await metadataRepository.save(metadata)
    return createdMetadata
  } catch (e) {
    console.log(e)
    return null
  }
}
