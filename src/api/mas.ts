import axios, { AxiosResponse } from 'axios'
import getEnv from '../utils/env'
import { matrixApi } from './matrix'
import { logger } from '../utils/logger'

// Create separate axios instance for MAS without tenant headers
const masApiClient = axios.create()

// Add auth interceptor for MAS requests using Matrix token
masApiClient.interceptors.request.use(async (config) => {
  try {
    // Use Matrix access token for MAS authentication
    const matrixToken = await matrixApi.getToken()
    if (matrixToken) {
      config.headers.Authorization = `Bearer ${matrixToken}`
    }
  } catch (error) {
    logger.error('Failed to get Matrix token for MAS request:', error)
  }

  return config
})

export interface AllowCrossSigningResetRequest {
  userId: string
}

export interface AllowCrossSigningResetResponse {
  data: {
    allowUserCrossSigningReset: {
      user: {
        id: string
      }
    }
  }
}

export const masApi = {
  /**
   * Get current authenticated user from MAS to retrieve their ULID
   */
  getCurrentUser: async (): Promise<AxiosResponse<{ data: { viewer: { id: string } } }>> => {
    const masBaseUrl = getEnv('APP_MAS_URL') as string

    const graphqlQuery = {
      query: `
        query GetCurrentUser {
          viewer {
            __typename
            ... on User {
              id
            }
          }
        }
      `
    }

    const response = await masApiClient.post(
      `${masBaseUrl}/graphql`,
      graphqlQuery,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    // Debug: log the full response to see what we're getting  
    logger.debug('MAS getCurrentUser response:', response.data)

    return response
  },

  /**
   * Call MAS GraphQL API to allow cross-signing reset for a user
   * This must be called before Matrix crypto.resetEncryption() to authorize the reset
   */
  allowCrossSigningReset: async (userId: string): Promise<AxiosResponse<AllowCrossSigningResetResponse>> => {
    const masBaseUrl = getEnv('APP_MAS_URL') as string

    // Debug: log the userId being sent to MAS
    console.log('🔐 MAS allowCrossSigningReset called with userId:', userId)

    const graphqlQuery = {
      query: `
        mutation AllowCrossSigningReset($userId: ID!) {
          allowUserCrossSigningReset(input: { userId: $userId }) {
            user {
              id
            }
          }
        }
      `,
      variables: {
        userId
      }
    }

    // Call MAS GraphQL endpoint directly using separate axios instance (no tenant headers)
    const response = await masApiClient.post(
      `${masBaseUrl}/graphql`,
      graphqlQuery,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    return response
  }
}
