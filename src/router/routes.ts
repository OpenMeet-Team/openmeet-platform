import { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'HomePage', component: () => import('pages/HomePage.vue') },
      {
        path: 'events',
        children: [
          { path: '', name: 'EventsPage', component: () => import('pages/EventsPage.vue') },
          { path: ':slug', name: 'EventPage', component: () => import('pages/EventPage.vue') },
          {
            path: ':slug/attendees',
            name: 'EventAttendeesPage',
            component: () => import('pages/event/EventAttendeesPage.vue')
          }
        ]
      },
      {
        path: 'event-series',
        children: [
          { path: 'create', name: 'CreateEventSeriesPage', component: () => import('pages/CreateEventSeriesPage.vue') },
          { path: ':slug', name: 'EventSeriesPage', component: () => import('pages/EventSeriesPage.vue') }
        ]
      },
      {
        path: 'groups',
        children: [
          { path: '', name: 'GroupsPage', component: () => import('pages/GroupsPage.vue') },
          {
            path: ':slug',
            name: 'GroupPage',
            redirect: { name: 'GroupAboutPage' },
            component: () => import('pages/GroupPage.vue'),
            children: [
              { path: '', name: 'GroupAboutPage', component: () => import('pages/group/GroupAboutPage.vue') },
              { path: 'events', name: 'GroupEventsPage', component: () => import('pages/group/GroupEventsPage.vue') },
              { path: 'members', name: 'GroupMembersPage', component: () => import('pages/group/GroupMembersPage.vue') },
              { path: 'discussions', name: 'GroupDiscussionsPage', component: () => import('pages/group/GroupDiscussionsPage.vue') }
            ]
          }
        ]
      },
      { path: 'members/:slug', name: 'MemberPage', component: () => import('pages/MemberPage.vue') },
      { path: 'messages', name: 'MessagesPage', component: () => import('pages/MessagesPage.vue'), meta: { requiresAuth: true } }
    ],
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'DashboardPage', component: () => import('pages/dashboard/DashboardPage.vue') },
      {
        path: 'events',
        children: [
          { path: '', name: 'DashboardEventsPage', component: () => import('pages/dashboard/DashboardEventsPage.vue') },
          { path: 'create', name: 'DashboardEventCreatePage', component: () => import('pages/dashboard/DashboardEventCreatePage.vue') },
          { path: ':slug', name: 'DashboardEventPage', component: () => import('pages/dashboard/DashboardEventPage.vue') }
        ]
      },
      {
        path: 'groups',
        children: [
          { path: '', name: 'DashboardGroupsPage', component: () => import('pages/dashboard/group/DashboardGroupsPage.vue') },
          { path: 'create', name: 'DashboardGroupCreatePage', component: () => import('pages/dashboard/group/DashboardGroupCreatePage.vue') },
          { path: ':slug', name: 'DashboardGroupPage', component: () => import('pages/dashboard/group/DashboardGroupPage.vue') }
        ]
      },
      { path: 'profile', name: 'DashboardProfilePage', component: () => import('pages/dashboard/ProfilePage.vue') }
    ],
    meta: { requiresAuth: true }
  },
  {
    path: '/admin',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'AdminPage', component: () => import('pages/admin/AdminPage.vue') },
      { path: 'bluesky-reset', name: 'BlueskyResetPage', component: () => import('pages/admin/BlueskyResetPage.vue') }
    ],
    meta: { requiresAuth: true }
  },
  {
    path: '/auth',
    name: 'Auth',
    component: () => import('layouts/AuthLayout.vue'),
    children: [
      { path: 'github/callback', name: 'AuthGithubCallbackPage', component: () => import('pages/auth/GithubCallbackPage.vue') },
      {
        path: 'bluesky/callback',
        name: 'AuthBlueskyCallbackPage',
        component: () => import('pages/auth/AuthBlueskyCallbackPage.vue')
      },
      { path: 'login', name: 'AuthLoginPage', component: () => import('pages/auth/LoginPage.vue') },
      { path: 'register', name: 'AuthRegisterPage', component: () => import('pages/auth/RegisterPage.vue') },
      {
        path: 'forgot-password',
        name: 'AuthForgotPasswordPage',
        component: () => import('pages/auth/ForgotPasswordPage.vue')
      },
      {
        path: 'password-change',
        name: 'AuthPasswordChangePage',
        component: () => import('pages/auth/PasswordChangePage.vue')
      },
      {
        path: 'confirm-email',
        component: () => import('pages/auth/ConfirmEmailPage.vue'),
        name: 'AuthConfirmEmailPage'
      },
      {
        path: 'confirm-new-email',
        component: () => import('pages/auth/ConfirmNewEmailPage.vue'),
        name: 'AuthConfirmNewEmailPage'
      },
      {
        path: 'collect-email',
        component: () => import('pages/auth/CollectEmailPage.vue'),
        name: 'AuthCollectEmailPage'
      }
    ],
    meta: { requiresAuth: false }
  },
  {
    path: '/auth/error',
    name: 'AuthErrorPage',
    component: () => import('pages/auth/ErrorPage.vue')
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
