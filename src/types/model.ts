import { UserEntity } from 'src/types/user.ts'

export enum SubCategoryType {
  EVENT = 'EVENT',
  GROUP = 'GROUP',
}

export enum GroupMemberPermissions {
  MANAGE_GROUP = 'MANAGE_GROUP',
  DELETE_GROUP = 'DELETE_GROUP',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
  MANAGE_EVENTS = 'MANAGE_EVENTS',
  MANAGE_DISCUSSIONS = 'MANAGE_DISCUSSIONS',
  MANAGE_REPORTS = 'MANAGE_REPORTS',
  MANAGE_BILLING = 'MANAGE_BILLING',
  SEE_MEMBERS = 'SEE_MEMBERS',
  SEE_EVENTS = 'SEE_EVENTS',
  SEE_DISCUSSIONS = 'SEE_DISCUSSIONS',
  MESSAGE_MEMBER = 'MESSAGE_MEMBER',
  MESSAGE_DISCUSSION = 'MESSAGE_DISCUSSION',
}

export interface FileEntity {
  id: number
  path?: string
  fileSize?: number
  fileName?: string
  mimeType?: string
  shortId?: string
  resizes?: Record<string, string>
}

export interface AddressLocation {
  location?: string
  lat?: number
  lon?: number
}

export interface OSMAddress {
  house_number?: string;
  road?: string;
  suburb?: string;
  borough?: string;
  city?: string;
  municipality?: string;
  district?: string;
  state?: string;
  ISO3166_2_lvl4?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

export interface OSMLocationSuggestion {
  place_id?: number;
  licence?: string;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  class?: string;
  type?: string;
  place_rank?: number;
  importance?: number;
  addresstype?: string;
  name?: string;
  display_name?: string;
  address?: OSMAddress;
  boundingbox?: string[];
}

export interface SubCategoryEntity {
  id: number,
  title: string,
  description?: string
  type: SubCategoryType
}

export interface CategoryEntity {
  id: number,
  slug?: string,
  name: string,
  subCategories: SubCategoryEntity[]
}

export interface OneTrustGeoLocationResponse {
  country: string
  state: string
  stateName: string
  continent: string
}

export interface Pagination<T> {
  data: T[]
  total: number
  page: number
  totalPages: number
}

export interface DiscussionReplyEntity {
  id: string
  author: UserEntity
  text: string
  datePosted: Date
}

// Represents a discussion topic in the group
export interface DiscussionEntity {
  id: string;
  topic: string;
  author: UserEntity;
  createdAt: Date;
  replies: DiscussionReplyEntity[];
}
