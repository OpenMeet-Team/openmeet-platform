import { UserEntity } from './user'

export enum SubCategoryType {
  EVENT = 'EVENT',
  GROUP = 'GROUP',
}

export interface ZulipTopicEntity {
  name: string;
  max_id: number;
}

export interface ZulipMessageEntity {
  id: number;
  sender_id: number;
  content: string;
  recipient_id?: number;
  timestamp: number;
  client?: string;
  subject?: string;
  topic_links?: [];
  is_me_message?: boolean;
  reactions?: [];
  submessages?: [];
  flags?: string[];
  sender_full_name: string;
  sender_email?: string;
  sender_realm_str?: string;
  display_recipient?: [
      {
          email: string;
          full_name: string;
          id: number;
          is_mirror_dummy: boolean;
      },
      {
          id: number;
          email: string;
          full_name: string;
          is_mirror_dummy: boolean;
      }
  ];
  type?: string;
  avatar_url?: string;
  content_type?: string;
}

export interface ChatEntity {
  id: number;
  ulid: string;
  participants: UserEntity[];
  participant: UserEntity;
  user: UserEntity;
  messages: ZulipMessageEntity[];
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
