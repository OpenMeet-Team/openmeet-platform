import { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'HomePage', component: () => import('pages/HomePage.vue') },
      { path: 'events', name: 'EventsPage', component: () => import('pages/EventsPage.vue') },
      { path: 'events/:eventId', name: 'EventPage', component: () => import('pages/EventPage.vue') }
    ],
    meta: { auth: false }
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      { path: 'login', name: 'AuthLoginPage', component: () => import('pages/auth/LoginPage.vue') },
      { path: 'register', name: 'AuthRegisterPage', component: () => import('pages/auth/RegisterPage.vue') },
      { path: 'forgot-password', name: 'AuthForgotPasswordPage', component: () => import('pages/auth/ForgotPasswordPage.vue') },
      { path: 'restore-password', name: 'AuthRestorePasswordPage', component: () => import('pages/auth/RestorePasswordPage.vue') }
    ],
    meta: { auth: false }
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  },
  {
    path: '/test',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }]
  }
]

export default routes
