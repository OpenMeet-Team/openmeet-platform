import { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('layouts/AppLayout.vue'),
    children: [
      { path: '', name: 'HomePage', component: () => import('pages/HomePage.vue') },
      { path: 'events', name: 'EventsPage', component: () => import('pages/EventsPage.vue') },
      {
        path: 'events/:slug?--:id',
        name: 'EventPage',
        component: () => import('pages/EventPage.vue')
      },
      {
        path: 'events/:slug?--:id/attendees',
        name: 'EventAttendeesPage',
        component: () => import('pages/event/EventAttendeesPage.vue')
      },
      { path: 'members/:id', name: 'MemberPage', component: () => import('pages/MemberPage.vue') },
      { path: 'messages', name: 'MessagesPage', component: () => import('pages/MessagesPage.vue'), meta: { requiresAuth: true } },
      { path: 'groups', name: 'GroupsPage', component: () => import('pages/GroupsPage.vue') },
      {
        path: 'groups/:slug?--:id',
        name: 'GroupPage',
        redirect: { name: 'GroupAboutPage' },
        component: () => import('pages/GroupPage.vue'),
        children: [
          { path: '', name: 'GroupAboutPage', component: () => import('pages/group/GroupAboutPage.vue') },
          { path: 'events', name: 'GroupEventsPage', component: () => import('pages/group/GroupEventsPage.vue') },
          { path: 'members', name: 'GroupMembersPage', component: () => import('pages/group/GroupMembersPage.vue') },
          {
            path: 'discussions',
            name: 'GroupDiscussionsPage',
            component: () => import('pages/group/GroupDiscussionsPage.vue')
          }
        ]
      }
    ],
    meta: { requiresAuth: false }
  },
  {
    path: '/dashboard',
    component: () => import('layouts/AppLayout.vue'),
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
        component: () => import('pages/dashboard/DashboardEventPage.vue')
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
        component: () => import('pages/dashboard/group/DashboardGroupPage.vue')
      },
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
      }
    ],
    meta: { requiresAuth: false }
  },
  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
