export enum SubCategoryType {
  EVENT = 'EVENT',
  GROUP = 'GROUP',
}

export interface UploadedFileEntity {
  path?: string
  id: string
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
