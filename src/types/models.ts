export interface Event {
  name: string;
  image: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  lat: number;
  lon: number;
  is_public: boolean;
}

export interface User {
  id: string
  email: string
  name?: string
  token: string
  refreshToken: string
}
