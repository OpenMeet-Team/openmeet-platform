import { defineStore } from 'pinia'
import { apiForgotPassword, apiLogin, apiLogout, apiRefreshToken, apiRegister, apiRestorePassword } from 'src/api/auth.ts'
import {
  ForgotPasswordCredentials,
  LoginCredentials,
  RefreshToken,
  RegisterCredentials,
  RestorePasswordCredentials,
  User
} from 'src/types/authTypes.ts'

export const useAuthStore = defineStore('authStore', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    refreshToken: localStorage.getItem('refreshToken') || '',
    user: JSON.parse(localStorage.getItem('user') || '{}')
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
        this.actionSetUser(response.data.user)
        return response
      } catch (error) {
        console.error('Login failed', error)
        throw error
      }
    },
    async actionRefreshToken (refreshToken: RefreshToken) {
      try {
        const response = await apiRefreshToken(refreshToken)
        this.actionSetToken(response.data.token)
        return response
      } catch (error) {
        console.error('Login failed', error)
        throw error
      }
    },
    async actionRegister (credentials: RegisterCredentials) {
      try {
        const response = await apiRegister(credentials)
        this.actionSetToken(response.data.token)
        this.actionSetRefreshToken(response.data.refreshToken)
        this.actionSetUser(response.data.user)
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
        const response = await apiForgotPassword(credentials)
        return response
      } catch (error) {
        console.error('actionForgotPassword failed', error)
        throw error
      }
    },
    async actionLogout () {
      try {
        await apiLogout()
      } catch (error) {
        console.error('Logout failed', error)
      } finally {
        this.actionClearAuth()
      }
    },
    actionSetToken (token: string) {
      this.token = token
      localStorage.setItem('token', token)
    },
    actionSetRefreshToken (refreshToken: string) {
      this.refreshToken = refreshToken
      localStorage.setItem('refreshToken', refreshToken)
    },
    actionSetUser (user: User) {
      this.user = user
      localStorage.setItem('user', JSON.stringify(user))
    },
    actionClearAuth () {
      this.token = ''
      this.refreshToken = ''
      this.user = {}
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
    }
  }
})
