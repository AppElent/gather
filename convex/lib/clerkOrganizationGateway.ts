import { GATHER_ORGANIZATION_MARKER } from '../../shared/gatherOrganizations'

export interface ClerkOrganizationRecord {
  id: string
  name: string
  slug: string
  createdBy: string | null
  publicMetadata: unknown
}

export interface ClerkOrganizationGateway {
  getBySlug(slug: string): Promise<ClerkOrganizationRecord | null>
  getById(id: string): Promise<ClerkOrganizationRecord | null>
  create(input: {
    name: string
    slug: string
    createdBy: string
    publicMetadata: typeof GATHER_ORGANIZATION_MARKER
  }): Promise<ClerkOrganizationRecord>
}
