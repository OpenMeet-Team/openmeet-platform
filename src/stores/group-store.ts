import { defineStore } from 'pinia'
import { groupsApi } from '../api/groups'
import { GroupEntity, GroupMemberEntity, GroupPermission, GroupRole, GroupVisibility } from '../types'
import { useNotification } from '../composables/useNotification'
import analyticsService from '../services/analyticsService'
import { logger } from '../utils/logger'

const { error } = useNotification()

export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null,
    isLoading: false,
    errorMessage: null as string | null,
    errorCode: null as number | null,
    groupMembers: null as GroupMemberEntity[] | null
  }),

  getters: {
    getterUserIsGroupMember: (state) => (): GroupMemberEntity | undefined => {
      return state.group?.groupMember
    },
    getterUserHasRole: (state) => (role: GroupRole) => {
      return state.group?.groupMember?.groupRole?.name === role
    },
    getterUserHasPermission: (state) => (permission: GroupPermission) => {
      return state.group?.groupMember?.groupRole?.groupPermissions?.some(p => p.name === permission)
    },
    getterIsPublicGroup: (state) => {
      return state.group?.visibility === GroupVisibility.Public
    },
    getterIsPrivateGroup: (state) => {
      return state.group?.visibility === GroupVisibility.Private
    },
    getterIsAuthenticatedGroup: (state) => {
      return state.group?.visibility === GroupVisibility.Authenticated
    },
    getterIsPermissionError: (state) => {
      return state.errorCode === 403
    }
  },

  actions: {
    async actionGetGroup (slug: string) {
      if (this.isLoading) {
        return
      }
      this.isLoading = true
      this.errorMessage = null
      this.errorCode = null
      try {
        const res = await groupsApi.getBySlug(slug)
        this.group = res.data
      } catch (err: unknown) {
        logger.debug('Group store error:', err)
        const axiosError = err as { response?: { status?: number; data?: { message?: string } } }
        this.errorCode = axiosError.response?.status || null
        if (axiosError.response?.status === 403) {
          // Extract the helpful error message from the backend
          this.errorMessage = axiosError.response?.data?.message || 'This group requires authentication or permission to view.'
        } else {
          this.errorMessage = 'Failed to fetch group data'
        }
      } finally {
        this.isLoading = false
      }
    },
    async actionGetGroupAbout (slug: string) {
      try {
        const res = await groupsApi.getAbout(slug)
        if (this.group) {
          this.group.events = res.data.events
          this.group.groupMembers = res.data.groupMembers
        }
      } catch (err) {
        logger.debug('Group store error:', err)
        this.errorMessage = 'Failed to fetch group data'
      }
    },
    async actionGetGroupMembers (slug: string) {
      try {
        const res = await groupsApi.getMembers(slug)
        if (this.group) {
          this.group.groupMembers = res.data
        }
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to fetch group data')
      }
    },
    async actionGetGroupEvents (slug: string) {
      try {
        const res = await groupsApi.getEvents(slug)
        if (this.group) {
          this.group.events = res.data
        }
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to fetch group data')
      }
    },

    async actionJoinGroup (slug: string) {
      try {
        const res = await groupsApi.join(slug)
        if (this.group) {
          if (res.data.groupRole.name !== GroupRole.Guest) {
            if (this.group.groupMembers?.find(m => m.id === res.data.id)) {
              this.group.groupMembers = this.group.groupMembers ? [...this.group.groupMembers, res.data] : [res.data]
            }
          }
          this.group.groupMember = res.data

          // Refresh group data to ensure we have the latest permissions and state
          await this.actionGetGroup(slug)
        }
        analyticsService.trackEvent('group_joined', { group_id: this.group?.id, name: this.group?.name })
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to join group')
      }
    },

    async actionLeaveGroup (slug: string) {
      try {
        await groupsApi.leave(slug)
        if (this.group) {
          this.group.groupMember = undefined
          analyticsService.trackEvent('group_left', { group_id: this.group?.id, name: this.group?.name })
        }
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to leave group')
      }
    },
    async actionDeleteGroup (slug: string) {
      try {
        await groupsApi.delete(slug)
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to delete group')
      }
    },
    async actionUpdateGroupMember (member: GroupMemberEntity) {
      if (this.group?.groupMembers) {
        this.group.groupMembers = this.group.groupMembers.map(m => m.id === member.id ? member : m)
      }
    },
    async actionRemoveGroupMember (slug: string, groupMemberId: number) {
      try {
        await groupsApi.removeMember(slug, groupMemberId).then(res => {
          if (this.group?.groupMembers) {
            this.group.groupMembers = this.group.groupMembers.filter(m => m.id !== res.data.id)
          }
        })
      } catch (err) {
        logger.debug('Group store error:', err)
        error('Failed to remove group member')
      }
    },

    /**
     * Send contact message from member to group admins
     */
    async actionContactAdmins (
      slug: string,
      contactType: 'question' | 'report' | 'feedback',
      subject: string,
      message: string
    ) {
      try {
        const res = await groupsApi.contactAdmins(slug, {
          contactType,
          subject,
          message
        })

        analyticsService.trackEvent('group_contact_admins', {
          groupSlug: slug,
          contactType,
          deliveredCount: res.data.deliveredCount
        })

        return res.data
      } catch (err) {
        console.error('Failed to send contact message to admins:', err)
        error('Failed to send contact message to admins')
        throw err
      }
    }
  }
})
