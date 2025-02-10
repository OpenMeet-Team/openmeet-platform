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
    blueskyHandle: LocalStorage.getItem('blueskyHandle') || ''
  }),
  getters: {
    isAuthenticated: state => !!state.token,
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
      return await authApi.refreshToken(this.refreshToken).then(response => {
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
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

      analyticsService.identify(this.user.ulid, {
        email: this.user.email,
        name: this.user.name
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
        const decodedProfileParam = atob(profileParam)
        const profile = JSON.parse(decodedProfileParam)

        this.actionSetToken(token)
        this.actionSetRefreshToken(refreshToken)
        this.actionSetTokenExpires(Number(tokenExpires))
        this.actionSetUser(user)

        const did = user.socialId
        console.log('Setting Bluesky identifiers from callback:', { did, handle: profile.handle, user })

        if (did && profile.handle) {
          this.actionSetBlueskyIdentifiers(did, profile.handle)
        } else {
          console.error('Missing Bluesky identifiers:', { did, handle: profile.handle, user })
        }

        try {
          const response = await authApi.getMe()
          if (response.data) {
            this.actionSetUser(response.data)
          }
        } catch (error) {
          console.error('Error fetching user profile:', error)
        }

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
        console.log('Dev login: Setting Bluesky identifiers:', { did, handle: credentials.identifier, user })

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
            handle: credentials.identifier
          }))
        })

        return this.handleBlueskyCallback(params)
      } catch (error) {
        console.error('Dev login failed', error)
        throw error
      }
    }
  }
})
