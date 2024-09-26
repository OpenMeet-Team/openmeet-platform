import { defineStore } from 'pinia'
import { apiForgotPassword, apiLogin, apiLogout, apiRefreshToken, apiRegister, apiRestorePassword } from 'src/api/auth.ts'
import {
  ForgotPasswordCredentials,
  LoginCredentials,
  RegisterCredentials,
  RestorePasswordCredentials,
  User
} from 'src/types/authTypes.ts'
import { LocalStorage } from 'quasar'

export const useAuthStore = defineStore('authStore', {
  state: () => ({
    token: LocalStorage.getItem('token') || '',
    refreshToken: LocalStorage.getItem('refreshToken') || '',
    tokenExpires: LocalStorage.getItem('tokenExpires') || '',
    user: JSON.parse(LocalStorage.getItem('user') || '{}')
  }),
  getters: {
    isAuthenticated: state => !!state.token,
    getUser: state => state.user
  },
  actions: {
    async actionLogin (credentials: LoginCredentials) {
      try {
        const response = await apiLogin(credentials)
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
    async actionRefreshToken () {
      return await apiRefreshToken(this.refreshToken).then(response => {
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetTokenExpires(response.data.tokenExpires)
        return response.data.token
      })
    },
    async actionRegister (credentials: RegisterCredentials) {
      try {
        const response = await apiRegister(credentials)
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
    async actionRestorePassword (credentials: RestorePasswordCredentials) {
      try {
        const response = await apiRestorePassword(credentials)
        return response
      } catch (error) {
        console.error('actionRestorePassword failed', error)
        throw error
      }
    },
    async actionForgotPassword (credentials: ForgotPasswordCredentials) {
      try {
        return await apiForgotPassword(credentials)
      } catch (error) {
        console.error('actionForgotPassword failed', error)
        throw error
      }
    },
    async actionLogout () {
      return apiLogout().finally(() => {
        this.actionClearAuth()
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
    actionSetUser (user: User) {
      this.user = user
      LocalStorage.setItem('user', JSON.stringify(user))
    },
    actionClearAuth () {
      this.token = ''
      this.refreshToken = ''
      this.user = {}
      LocalStorage.removeItem('token')
      LocalStorage.removeItem('refreshToken')
      LocalStorage.removeItem('tokenExpires')
      LocalStorage.removeItem('user')
    }
  }
})
