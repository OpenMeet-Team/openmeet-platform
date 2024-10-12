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
      { path: 'events', name: 'DashboardEventsPage', component: () => import('pages/dashboard/DashboardEventsPage.vue') },
      {
        path: 'events/create',
        name: 'DashboardEventCreatePage',
        component: () => import('pages/dashboard/DashboardEventCreatePage.vue')
      },
      {
        path: 'events/:id',
        name: 'DashboardEventPage',
        redirect: { name: 'DashboardEventGeneralPage' },
        component: () => import('pages/dashboard/DashboardEventPage.vue'),
        children: [
          {
            path: 'general',
            name: 'DashboardEventGeneralPage',
            component: () => import('pages/dashboard/event/DashboardEventGeneralPage.vue')
          },
          {
            path: 'attendees',
            name: 'DashboardEventAttendeesPage',
            component: () => import('pages/dashboard/event/DashboardEventAttendeesPage.vue')
          }
        ]
      },
      {
        path: 'groups',
        name: 'DashboardGroupsPage',
        component: () => import('pages/dashboard/group/DashboardGroupsPage.vue')
      },
      {
        path: 'groups/create',
        name: 'DashboardGroupsCreatePage',
        component: () => import('pages/dashboard/group/DashboardGroupCreatePage.vue')
      },
      {
        path: 'groups/:id',
        name: 'DashboardGroupPage',
        component: () => import('pages/dashboard/group/DashboardGroupPage.vue'),
        children: [
          {
            path: 'basic',
            name: 'DashboardGroupBasicPage',
            component: () => import('pages/dashboard/group/DashboardGroupBasicPage.vue')
          },
          {
            path: 'members',
            name: 'DashboardGroupMembersPage',
            component: () => import('pages/dashboard/group/DashboardGroupMembersPage.vue')
          },
          {
            path: 'privacy',
            name: 'DashboardGroupPrivacyPage',
            component: () => import('pages/dashboard/group/DashboardGroupPrivacyPage.vue')
          }
        ]
      },
      { path: 'tickets', name: 'DashboardTicketsPage', component: () => import('pages/dashboard/TicketsPage.vue') },
      { path: 'messages', name: 'DashboardMessagesPage', component: () => import('pages/dashboard/MessagesPage.vue') },
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
      {
        path: 'forgot-password',
        name: 'AuthForgotPasswordPage',
        component: () => import('pages/auth/ForgotPasswordPage.vue')
      },
      {
        path: 'restore-password',
        name: 'AuthRestorePasswordPage',
        component: () => import('pages/auth/RestorePasswordPage.vue')
      }
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
