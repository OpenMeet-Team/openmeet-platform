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
  /** Whether this identity has an active session for publishing */
  hasActiveSession: boolean
  /** When the identity was created */
  createdAt: Date
  /** When the identity was last updated */
  updatedAt: Date
}

/**
 * AT Protocol Identity Recovery Status
 * Indicates if an existing account can be recovered
 */
export interface AtprotoRecoveryStatusDto {
  /** Whether the user has an existing AT Protocol account that can be recovered */
  hasExistingAccount: boolean
}

/**
 * Response from initiating take ownership flow
 */
export interface TakeOwnershipInitiateResponseDto {
  /** The email address where the password reset was sent */
  email: string
}
