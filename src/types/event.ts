import { CategoryEntity, FileEntity, Pagination, ZulipMessageEntity, ZulipTopicEntity } from './model'
import { GroupEntity, GroupMemberEntity } from './group'
import { UserEntity } from './user'

export enum EventType {
  Online = 'online',
  InPerson = 'in-person',
  Hybrid = 'hybrid'
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
  ViewDiscussion = 'VIEW_DISCUSSION'
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

export interface EventAttendeePermissionEntity {
  id: number
  name: EventAttendeePermission
}

export interface EventAttendeeRoleEntity {
  id: number
  name: EventAttendeeRole
  permissions: EventAttendeePermissionEntity[]
}

interface EventCategory extends CategoryEntity {}

export interface EventAttendeeEntity {
  id: number
  userId: number
  // eslint-disable-next-line no-use-before-define
  event: EventEntity
  user: UserEntity
  role: EventAttendeeRoleEntity
  status: EventAttendeeStatus
  approvalAnswer?: string
  createdAt?: string
}

export interface EventTopicCommentEntity {
  // id: number
  // content: string
  // user: UserEntity
  // topic?: string
}

export interface EventEntity {
  id: number
  ulid: string
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
  topics?: ZulipTopicEntity[]
  messages?: ZulipMessageEntity[]
}

export interface EventPaginationEntity extends Pagination<EventEntity> {}
export interface EventAttendeePaginationEntity extends Pagination<EventAttendeeEntity> {}
