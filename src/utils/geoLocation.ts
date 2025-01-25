import axios from 'axios'
import { OneTrustGeoLocationResponse } from '../types'

const CACHE_KEY = 'geoLocation'
const CACHE_EXPIRATION_KEY = 'geoLocationExpiration'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Helper to check if the cached data is expired
function isCacheExpired (): boolean {
  const cachedExpiration = localStorage.getItem(CACHE_EXPIRATION_KEY)
  if (!cachedExpiration) return true
  const expirationTime = parseInt(cachedExpiration, 10)
  return Date.now() > expirationTime
}

// Save geolocation to cache with expiration timestamp
function cacheGeoLocation (location: OneTrustGeoLocationResponse) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(location))
  localStorage.setItem(CACHE_EXPIRATION_KEY, (Date.now() + CACHE_DURATION).toString())
}

// Get cached geolocation
function getCachedGeoLocation (): OneTrustGeoLocationResponse | null {
  const cachedData = localStorage.getItem(CACHE_KEY)
  return cachedData ? JSON.parse(cachedData) : null
}

// Function to fetch geolocation (or use cache if available and valid)
export async function getGeoLocation (refresh: boolean = false): Promise<OneTrustGeoLocationResponse | null> {
  if (!isCacheExpired() && !refresh) {
    const cachedLocation = getCachedGeoLocation()
    if (cachedLocation) {
      return cachedLocation
    }
  }

  try {
    const response = await axios.get('https://geolocation.onetrust.com/cookieconsentpub/v1/geo/location')
    const location = response.data
    cacheGeoLocation(location)
    return location
  } catch (error) {
    console.error('Error fetching geolocation:', error)
    return null
  }
}
