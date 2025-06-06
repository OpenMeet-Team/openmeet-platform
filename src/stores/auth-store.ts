import { defineStore } from 'pinia'
import { authApi } from '../api/auth'
import { LocalStorage } from 'quasar'
import {
  ApiAuthUser,
  StoreAuthForgotPasswordRequest,
  StoreAuthLoginRequest,
  StoreAuthRegisterRequest,
  StoreAuthRestorePasswordRequest,
  UserEntity,
  UserRole,
  UserPermission
} from '../types'
import analyticsService from '../services/analyticsService'

export const useAuthStore = defineStore('authStore', {
  state: () => ({
    token: LocalStorage.getItem('token') || '',
    refreshToken: LocalStorage.getItem('refreshToken') || '',
    tokenExpires: LocalStorage.getItem('tokenExpires') || '',
    user: JSON.parse(LocalStorage.getItem('user') || '{}') as UserEntity,
    role: UserRole.User,
    permissions: [] as string[],
    blueskyDid: LocalStorage.getItem('blueskyDid') || '',
    blueskyHandle: LocalStorage.getItem('blueskyHandle') || '',
    isInitialized: false,
    isInitializing: false
  }),
  getters: {
    isAuthenticated: state => !!state.token,
    isFullyAuthenticated: state => state.isInitialized && !!state.token,
    getUser: state => {
      return state.user
    },
    hasRole: (state) => (role: UserRole) => state.user.role?.name === role,
    hasPermission: (state) => (permission: UserPermission) => state.user.role?.permissions.some(p => p.name === permission),
    getUserId: state => state.user.id,
    getBlueskyDid: state => state.blueskyDid,
    getBlueskyHandle: state => state.blueskyHandle,
    getBlueskEndpoint: state => {
      const handle = state.blueskyHandle
      // alice.bsky.social has an endpoint bsky.social for the agent
      // remove the first part of the handle
      const parts = handle.split('.')
      return 'https://' + parts.slice(1).join('.')
    }
  },
  actions: {
    async actionLogin (credentials: StoreAuthLoginRequest) {
      try {
        const response = await authApi.login(credentials)
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        this.actionSetUser(response.data.user)
        return response
      } catch (error) {
        console.error('Login failed', error)
        throw error
      }
    },
    async actionGoogleLogin (idToken: string) {
      try {
        const response = await authApi.googleLogin(idToken)
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        this.actionSetUser(response.data.user)

        // Fetch full user profile
        const meResponse = await authApi.getMe()
        if (meResponse.data) {
          this.actionSetUser(meResponse.data)
        }

        return response.data.token
      } catch (error) {
        console.error('Google login error:', error)
        throw error
      }
    },
    async actionGithubLogin (code: string) {
      try {
        const response = await authApi.githubLogin(code)
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        this.actionSetUser(response.data.user)

        // Fetch full user profile
        const meResponse = await authApi.getMe()
        if (meResponse.data) {
          this.actionSetUser(meResponse.data)
        }

        return response.data.token
      } catch (error) {
        console.error('Github login error:', error.response?.data || error)
        throw error
      }
    },
    async actionRefreshToken () {
      console.log('🔄 Auth Store: actionRefreshToken called with token:', this.refreshToken ? this.refreshToken.substring(0, 20) + '...' : 'null')
      return await authApi.refreshToken(this.refreshToken).then(response => {
        console.log('✅ Auth Store: Token refresh successful')
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
      }).catch(error => {
        console.log('🔴 Auth Store: Token refresh failed:', error)
        throw error
      })
    },
    async actionRegister (credentials: StoreAuthRegisterRequest) {
      try {
        const response = await authApi.register(credentials)
        if (response.data.token) this.actionSetToken(response.data.token)
        if (response.data.refreshToken) this.actionSetRefreshToken(response.data.refreshToken)
        if (response.data.tokenExpires) this.actionSetTokenExpires(response.data.tokenExpires)
        if (response.data.user) this.actionSetUser(response.data.user)
        return response
      } catch (error) {
        console.error('Registration failed', error)
        throw error
      }
    },
    async actionRestorePassword (credentials: StoreAuthRestorePasswordRequest) {
      try {
        return await authApi.restorePassword(credentials)
      } catch (error) {
        console.error('actionRestorePassword failed', error)
        throw error
      }
    },
    async actionForgotPassword (credentials: StoreAuthForgotPasswordRequest) {
      try {
        return await authApi.forgotPassword(credentials)
      } catch (error) {
        console.error('actionForgotPassword failed', error)
        throw error
      }
    },
    async actionLogout () {
      return authApi.logout().finally(() => {
        this.actionClearAuth()
        analyticsService.trackEvent('user_logged_out')
        analyticsService.reset()
      }).catch((error) => {
        console.error('Logout failed', error)
      })
    },
    actionSetToken (token: string) {
      this.token = token
      LocalStorage.setItem('token', token)
    },
    actionSetRefreshToken (refreshToken: string) {
      this.refreshToken = refreshToken
      LocalStorage.setItem('refreshToken', refreshToken)
    },
    actionSetTokenExpires (tokenExpires: number) {
      this.tokenExpires = tokenExpires
      LocalStorage.setItem('tokenExpires', tokenExpires)
    },
    actionSetUser (user: ApiAuthUser) {
      this.user = user
      LocalStorage.setItem('user', JSON.stringify(user))

      analyticsService.identify(this.user.slug, {
        email: this.user.email,
        name: this.user.name,
        ulid: this.user.ulid
      })
      analyticsService.trackEvent('user_authorized', { user_id: this.user.id, email: this.user.email, name: this.user.name })
    },
    actionClearAuth () {
      this.token = ''
      this.refreshToken = ''
      this.user = {} as UserEntity
      this.blueskyDid = ''
      this.blueskyHandle = ''
      LocalStorage.removeItem('token')
      LocalStorage.removeItem('refreshToken')
      LocalStorage.removeItem('tokenExpires')
      LocalStorage.removeItem('user')
      LocalStorage.removeItem('blueskyDid')
      LocalStorage.removeItem('blueskyHandle')
    },
    actionSetRole (role: UserRole) {
      this.role = role
    },
    actionSetPermissions (permissions: string[]) {
      this.permissions = permissions
    },
    actionSetBlueskyIdentifiers (did: string, handle: string) {
      if (did && did !== 'undefined') {
        this.blueskyDid = did
        this.blueskyHandle = handle
        LocalStorage.setItem('blueskyDid', did)
        LocalStorage.setItem('blueskyHandle', handle)
      }
    },
    async handleBlueskyCallback (params: URLSearchParams) {
      try {
        const token = params.get('token')
        const refreshToken = params.get('refreshToken')
        const tokenExpires = params.get('tokenExpires')
        const userParam = params.get('user')
        const profileParam = params.get('profile')

        if (!token || !refreshToken || !tokenExpires || !userParam || !profileParam) {
          console.error('Missing required parameters')
          return false
        }

        const decodedUserParam = atob(userParam)
        const user = JSON.parse(decodedUserParam)
        // Check for null/undefined email and convert to empty string to avoid issues
        if (user.email === null || user.email === undefined || user.email === 'null') {
          user.email = ''
        }

        const decodedProfileParam = atob(profileParam)
        const profile = JSON.parse(decodedProfileParam)

        this.actionSetToken(token)
        this.actionSetRefreshToken(refreshToken)
        this.actionSetTokenExpires(Number(tokenExpires))
        this.actionSetUser(user)

        const did = user.socialId
        if (did && profile.handle) {
          this.actionSetBlueskyIdentifiers(did, profile.handle)
        } else {
          console.error('Missing Bluesky identifiers:', { did, handle: profile.handle })
        }

        // Update user with Bluesky preferences
        const userEmail = user.email !== null && user.email !== undefined && user.email !== 'null' ? user.email : ''

        const updatedUser = {
          ...user,
          email: userEmail,
          preferences: {
            ...user.preferences,
            bluesky: {
              did: user.socialId,
              handle: profile.handle,
              connected: true,
              autoPost: false,
              connectedAt: new Date(),
              disconnectedAt: null
            }
          }
        }
        this.actionSetUser(updatedUser)

        return true
      } catch (error) {
        console.error('Bluesky callback error:', error)
        throw error
      }
    },
    async actionDevLogin (credentials: { identifier: string, password: string }) {
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Dev login only available in development')
      }

      try {
        const response = await authApi.devLogin(credentials)
        const { token, refreshToken, tokenExpires, user } = response.data

        // Use socialId directly from user object
        const did = user.socialId
        console.log('Dev login: Setting Bluesky identifiers:', {
          did,
          handle: credentials.identifier,
          user
        })

        if (did) {
          this.actionSetBlueskyIdentifiers(did, credentials.identifier)
        }

        const params = new URLSearchParams({
          token,
          refreshToken,
          tokenExpires: tokenExpires.toString(),
          user: btoa(JSON.stringify(user)),
          profile: btoa(JSON.stringify({
            did,
            handle: credentials.identifier,
            avatar: `https://cdn.bsky.app/img/avatar/plain/${did}@bsky.social`
          }))
        })

        return this.handleBlueskyCallback(params)
      } catch (error) {
        console.error('Dev login failed', error)
        throw error
      }
    },
    async initializeAuth () {
      // If already initialized or initializing, return early
      if (this.isInitialized) {
        return
      }

      // If already initializing, wait for it to complete
      if (this.isInitializing) {
        await this.waitForInitialization()
        return
      }

      this.isInitializing = true

      try {
        // Check if we have a token
        if (this.token) {
          try {
            // Validate the token by fetching user data
            const response = await authApi.getMe()
            this.actionSetUser(response.data)
          } catch (error) {
            console.error('Token validation failed, clearing auth:', error)
            this.actionClearAuth()
          }
        }
      } finally {
        this.isInitialized = true
        this.isInitializing = false
      }
    },
    async waitForInitialization () {
      // If already initialized, return immediately
      if (this.isInitialized) {
        return
      }

      // Otherwise, poll until initialized
      const maxWaitTime = 5000 // 5 seconds
      const pollInterval = 50 // 50ms
      const startTime = Date.now()

      while (!this.isInitialized) {
        if (Date.now() - startTime > maxWaitTime) {
          throw new Error('Auth initialization timeout')
        }
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }
  }
})
