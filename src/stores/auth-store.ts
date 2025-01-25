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
    isHandlingCallback: false
  }),
  getters: {
    isAuthenticated: state => !!state.token,
    getUser: state => state.user,
    hasRole: (state) => (role: UserRole) => state.user.role?.name === role,
    hasPermission: (state) => (permission: UserPermission) => state.user.role?.permissions.some(p => p.name === permission),
    getUserId: state => state.user.id
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
      return await authApi.googleLogin(idToken).then(response => {
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
      })
    },
    async actionGithubLogin (code: string) {
      return await authApi.githubLogin(code).then(response => {
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
      })
    },
    async actionBlueskyLogin (handle: string) {
      return await authApi.blueskyLogin(handle).then(response => {
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
      })
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
    async handleBlueskyCallback (params: URLSearchParams) {
      if (this.isHandlingCallback) {
        console.log('Already handling Bluesky callback')
        return false
      }

      this.isHandlingCallback = true
      console.log('Starting Bluesky callback handling')

      try {
        const token = params.get('token')
        const refreshToken = params.get('refreshToken')
        const tokenExpires = params.get('tokenExpires')
        const user = params.get('user')

        console.log('Received callback params:', {
          hasToken: !!token,
          hasRefreshToken: !!refreshToken,
          hasTokenExpires: !!tokenExpires,
          hasUser: !!user
        })

        if (token && refreshToken && tokenExpires && user) {
          // Set values sequentially to avoid race conditions
          await Promise.all([
            this.actionSetToken(token),
            this.actionSetRefreshToken(refreshToken),
            this.actionSetTokenExpires(Number(tokenExpires)),
            this.actionSetUser(JSON.parse(user))
          ])

          console.log('Successfully set auth data')
          return true
        }

        console.log('Missing required callback parameters')
        return false
      } catch (error) {
        console.error('Bluesky callback error:', error)
        throw error
      } finally {
        this.isHandlingCallback = false
        console.log('Finished Bluesky callback handling')
      }
    },
    actionSetToken (token: string) {
      return new Promise<void>(resolve => {
        this.token = token
        LocalStorage.setItem('token', token)
        resolve()
      })
    },
    actionSetRefreshToken (refreshToken: string) {
      return new Promise<void>(resolve => {
        this.refreshToken = refreshToken
        LocalStorage.setItem('refreshToken', refreshToken)
        resolve()
      })
    },
    actionSetTokenExpires (tokenExpires: number) {
      return new Promise<void>(resolve => {
        this.tokenExpires = tokenExpires
        LocalStorage.setItem('tokenExpires', tokenExpires)
        resolve()
      })
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
      LocalStorage.removeItem('token')
      LocalStorage.removeItem('refreshToken')
      LocalStorage.removeItem('tokenExpires')
      LocalStorage.removeItem('user')
    },
    actionSetRole (role: UserRole) {
      this.role = role
    },
    actionSetPermissions (permissions: string[]) {
      this.permissions = permissions
    }
  }
})
