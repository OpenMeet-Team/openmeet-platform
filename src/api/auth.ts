import { AxiosResponse } from 'axios'
import { api } from 'boot/axios'

// Define types for input parameters
interface LoginCredentials {
  email: string
  password: string
}

interface RegisterCredentials {
  email: string
  password: string
  confirmPassword: string
  username?: string
}

interface ForgotPasswordCredentials {
  email: string
}

interface RestorePasswordCredentials {
  email: string,
  password: string,
  token: string
}

// Authentication Endpoints with TypeScript types
export function login (credentials: LoginCredentials): Promise<AxiosResponse> {
  return api.post('/auth/login', credentials)
}

export function register (credentials: RegisterCredentials): Promise<AxiosResponse> {
  return api.post('/auth/register', credentials)
}

export function forgotPassword (credentials: ForgotPasswordCredentials): Promise<AxiosResponse> {
  return api.post('/auth/forgot-password', credentials)
}

export function restorePassword (credentials: RestorePasswordCredentials): Promise<AxiosResponse> {
  return api.post('/auth/restore-password', credentials)
}

export function logout (): Promise<AxiosResponse> {
  return api.post('/auth/logout')
}
