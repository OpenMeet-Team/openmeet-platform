import { CategoryEntity, FileEntity, Pagination } from 'src/types/model.ts'
import { GroupEntity, GroupMemberEntity } from 'src/types/group.ts'
import { UserEntity } from 'src/types/user.ts'

export enum EventType {
  Online = 'online',
  InPerson = 'in-person',
  Hybrid = 'hybrid'
}
export enum EventVisibility {
  Public = 'public',
  Authenticated = 'authenticated',
  Private = 'private'
}
export enum EventStatus {
  Draft = 'draft',
  Pending = 'pending',
  Published = 'published',
  Cancelled = 'cancelled'
}
export enum EventAttendeeRole {
  Participant = 'participant',
  Host = 'host',
  Speaker = 'speaker',
  Moderator = 'moderator',
  Guest = 'guest'
}
export enum EventAttendeeStatus {
  Invited = 'invited',
  Confirmed = 'confirmed',
  Attended = 'attended',
  Cancelled = 'cancelled',
  Rejected = 'rejected',
  Maybe = 'maybe',
  Pending = 'pending',
  Waitlist = 'waitlist'
}

interface EventCategory extends CategoryEntity {}

export interface EventAttendeeEntity {
  id: number
  userId: number
  // eslint-disable-next-line no-use-before-define
  event: EventEntity
  user: UserEntity
  role: EventAttendeeRole
  status: EventAttendeeStatus
}

export enum EventAttendeePermission {
  DeleteEvent = 'DELETE_EVENT',
  CancelEvent = 'CANCEL_EVENT',
  ManageEvent = 'MANAGE_EVENT',
  ApproveAttendees = 'APPROVE_ATTENDEES',
  DeleteAttendees = 'DELETE_ATTENDEES',
  ManageAttendees = 'MANAGE_ATTENDEES',
  ManageDiscussions = 'MANAGE_DISCUSSIONS',
  ViewEvent = 'VIEW_EVENT',
  AttendEvent = 'ATTEND_EVENT',
  MessageAttendees = 'MESSAGE_ATTENDEES',
  CreateDiscussion = 'CREATE_DISCUSSION',
}

export interface EventEntity {
  id: number
  slug: string
  name: string
  startDate: string
  endDate?: string
  type: EventType
  location?: string
  locationOnline?: string
  lat?: number
  lon?: number
  image?: FileEntity | string
  description?: string
  maxAttendees?: number
  attendees?: EventAttendeeEntity[]
  attendeesCount?: number
  categories?: EventCategory[] | number[]
  groupId?: number
  group?: GroupEntity
  visibility?: EventVisibility
  userId?: number
  user?: UserEntity
  status?: EventStatus
  requireApproval?: boolean
  approvalQuestion?: string
  allowWaitlist?: boolean
  requireGroupMembership?: boolean
  groupMember?: GroupMemberEntity
  attendee?: EventAttendeeEntity
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
