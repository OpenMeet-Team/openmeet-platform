import { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'HomePage', component: () => import('pages/HomePage.vue') },
      { path: 'chat', name: 'ChatPage', component: () => import('pages/ChatPage.vue') },
      { path: 'events', name: 'EventsPage', component: () => import('pages/EventsPage.vue') },
      { path: 'events/:id', name: 'EventPage', component: () => import('pages/EventPage.vue') },
      { path: 'groups', name: 'GroupsPage', component: () => import('pages/GroupsPage.vue') },
      { path: 'groups/:id', name: 'GroupPage', component: () => import('pages/GroupPage.vue') }
    ],
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    component: () => import('layouts/DashboardLayout.vue'),
    children: [
      { path: '', name: 'DashboardPage', component: () => import('pages/dashboard/DashboardPage.vue') },
      { path: 'events', name: 'DashboardEventsPage', component: () => import('pages/dashboard/EventsPage.vue') },
      { path: 'events/create', name: 'DashboardEventsCreate', component: () => import('pages/dashboard/EventsPage.vue') },
      { path: 'groups', name: 'DashboardGroupsPage', component: () => import('pages/dashboard/GroupsPage.vue') },
      { path: 'groups/create', name: 'DashboardGroupsCreate', component: () => import('pages/dashboard/GroupsPage.vue') },
      { path: 'tickets', name: 'DashboardTicketsPage', component: () => import('pages/dashboard/TicketsPage.vue') },
      { path: 'profile', name: 'DashboardProfilePage', component: () => import('pages/dashboard/ProfilePage.vue') }
    ],
    meta: { requiresAuth: true }
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
    meta: { requiresAuth: false }
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
