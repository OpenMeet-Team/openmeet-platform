/**
 * AT Protocol Identity Data Transfer Object
 * Represents a user's AT Protocol identity as returned by the API
 */
export interface AtprotoIdentityDto {
  /** The decentralized identifier (DID) */
  did: string
  /** The AT Protocol handle (e.g., "alice.opnmt.me") */
  handle: string | null
  /** The PDS URL hosting this identity */
  pdsUrl: string
  /** Whether OpenMeet manages the credentials (custodial) */
  isCustodial: boolean
  /** Whether hosted on OpenMeet's PDS */
  isOurPds: boolean
  /** When the identity was created */
  createdAt: Date
  /** When the identity was last updated */
  updatedAt: Date
}
