import { UserEntity, UserRole } from '../types/user'
import { EventEntity, EventAttendeePermission } from '../types/event'
import { GroupEntity } from '../types/group'
import { MatrixMessage } from '../types/matrix'

/**
 * Chat Permission Utilities
 *
 * These functions determine whether a user can perform various chat actions
 * based on their role and permissions in the current context.
 */

/**
 * Check if a user can redact (delete) a specific message in an event chat
 *
 * Rules:
 * - Users can always redact their own messages
 * - Users with MANAGE_DISCUSSIONS permission can redact any message
 * - System admins can redact any message
 */
export function canRedactEventMessage (
  user: UserEntity,
  message: MatrixMessage,
  event: EventEntity
): boolean {
  // System admin can redact any message
  if (user.role?.name === UserRole.Admin) {
    return true
  }

  // User can always redact their own messages
  if (isOwnMessage(user, message)) {
    return true
  }

  // Check if user has MANAGE_DISCUSSIONS permission for this event
  return hasEventPermission(user, event, EventAttendeePermission.ManageDiscussions)
}

/**
 * Check if a user can redact (delete) a specific message in a group chat
 *
 * Rules:
 * - Users can always redact their own messages
 * - Users with MANAGE_DISCUSSIONS permission can redact any message
 * - System admins can redact any message
 */
export function canRedactGroupMessage (
  user: UserEntity,
  message: MatrixMessage,
  group: GroupEntity
): boolean {
  // System admin can redact any message
  if (user.role?.name === UserRole.Admin) {
    return true
  }

  // User can always redact their own messages
  if (isOwnMessage(user, message)) {
    return true
  }

  // Check if user has MANAGE_DISCUSSIONS permission for this group
  return hasGroupPermission(user, group, 'MANAGE_DISCUSSIONS')
}

/**
 * Check if a message belongs to the current user
 */
function isOwnMessage (user: UserEntity, message: MatrixMessage): boolean {
  // Extract username from Matrix user ID (@username:domain or @username_tenant:domain)
  const matrixUserId = message.sender
  if (!matrixUserId || !user.matrixUserId) {
    return false
  }

  // Compare Matrix user IDs directly
  return matrixUserId === user.matrixUserId
}

/**
 * Check if a user has a specific permission for an event
 */
function hasEventPermission (
  user: UserEntity,
  event: EventEntity,
  permission: EventAttendeePermission
): boolean {
  // Find the user's attendance record for this event
  const attendeeRecord = event.attendees?.find(
    attendee => attendee.user.id === user.id
  )

  if (!attendeeRecord) {
    return false
  }

  // Check if their role has the required permission
  const hasPermission = attendeeRecord.role?.permissions?.some(
    p => p.name === permission
  )

  return hasPermission || false
}

/**
 * Check if a user has a specific permission for a group
 */
function hasGroupPermission (
  user: UserEntity,
  group: GroupEntity,
  permission: string
): boolean {
  // Find the user's membership record for this group
  const memberRecord = group.groupMembers?.find(
    member => member.user.id === user.id
  )

  if (!memberRecord || !memberRecord.groupRole) {
    return false
  }

  // Check if their role has the required permission
  const hasPermission = memberRecord.groupRole.groupPermissions?.some(
    p => p.name === permission
  )

  return hasPermission || false
}

/**
 * Get the appropriate redaction reason prompt based on whether user owns the message
 */
export function getRedactionReasonPrompt (
  user: UserEntity,
  message: MatrixMessage
): string {
  if (isOwnMessage(user, message)) {
    return 'Why are you deleting this message? (optional)'
  } else {
    return 'Reason for removing this message: (optional)'
  }
}

/**
 * Get the appropriate confirmation message for redaction
 */
export function getRedactionConfirmationMessage (
  user: UserEntity,
  message: MatrixMessage
): string {
  if (isOwnMessage(user, message)) {
    return 'Are you sure you want to delete your message? This action cannot be undone.'
  } else {
    return 'Are you sure you want to remove this message? This action cannot be undone and will be logged as a moderation action.'
  }
}
