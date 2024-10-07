export interface UploadedFile {
  path: string
  id: string
}

export interface Location {
  // name?: string
  // address: Address
  // city?: string
  // state?: string
  // country?: string
  // lat?: number
  // lon?: number
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

export interface Category {
  id: number,
  slug?: string,
  name: string
}

export interface SubCategory {
  id: number,
  title: string,
  description: string
}
