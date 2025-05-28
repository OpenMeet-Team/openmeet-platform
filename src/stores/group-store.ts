import { defineStore } from 'pinia'
import { groupsApi } from '../api/groups'
import { chatApi } from '../api/chat'
import { GroupEntity, GroupMemberEntity, GroupPermission, GroupRole, GroupVisibility } from '../types'
import { useNotification } from '../composables/useNotification'
import analyticsService from '../services/analyticsService'

const { error } = useNotification()

export const useGroupStore = defineStore('group', {
  state: () => ({
    group: null as GroupEntity | null,
    isLoading: false,
    errorMessage: null as string | null,
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
    }
  },

  actions: {
    async actionGetGroup (slug: string) {
      if (this.isLoading) {
        return
      }
      this.isLoading = true
      try {
        const res = await groupsApi.getBySlug(slug)
        this.group = res.data
      } catch (err) {
        console.log(err)
        this.errorMessage = 'Failed to fetch group data'
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
          this.group.messages = res.data.messages
          this.group.topics = res.data.topics
        }
      } catch (err) {
        console.log(err)
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
        console.log(err)
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
        console.log(err)
        error('Failed to fetch group data')
      }
    },
    async actionGetGroupDiscussions (slug: string) {
      try {
        const res = await groupsApi.getDiscussions(slug)
        if (this.group) {
          this.group.messages = res.data.messages
          this.group.topics = res.data.topics
        }
      } catch (err) {
        console.log(err)
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
        }
        analyticsService.trackEvent('group_joined', { group_id: this.group?.id, name: this.group?.name })
      } catch (err) {
        console.log(err)
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
        console.log(err)
        error('Failed to leave group')
      }
    },
    async actionDeleteGroup (slug: string) {
      try {
        await groupsApi.delete(slug)
      } catch (err) {
        console.log(err)
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
        console.log(err)
        error('Failed to remove group member')
      }
    },

    /**
     * Send a message to the group discussion
     * Uses the new chat API endpoint for better integration with the unified message store
     */
    async actionSendGroupDiscussionMessage (message: string): Promise<string | number | undefined> {
      try {
        if (this.group?.slug) {
          console.log('Sending discussion message to group:', this.group.slug, message)

          try {
            // Use the new chatApi endpoint instead of groupsApi
            const res = await chatApi.sendGroupMessage(this.group.slug, message)
            console.log('Group discussion message sent successfully, ID:', res.data.id)

            // After sending a message, check if we can get the roomId (if not already set)
            if (!this.group.roomId) {
              // Slight delay to ensure backend has processed the message
              console.log('Waiting briefly before loading messages to get room ID')
              await new Promise(resolve => setTimeout(resolve, 500))

              console.log('Attempting to load messages to get room ID after sending message')
              await this.actionGetGroupDiscussionMessages()
                .then(result => {
                  console.log('Got messages after sending:', result.messages?.length || 0)
                })
                .catch(e => console.error('Error getting messages after send:', e))
            }

            return res.data.id
          } catch (apiErr) {
            // Check if this is a permissions error (403)
            if (apiErr.response && apiErr.response.status === 403) {
              console.warn('Permission denied when sending message to group discussion')
              throw new Error('Permission denied: Cannot send messages to this group discussion')
            }

            // Rethrow other errors
            throw apiErr
          }
        }
      } catch (err) {
        console.error('Failed to send group discussion message:', err)
        error('Failed to send group discussion message')
        throw err
      }
    },

    /**
     * Get messages for the group discussion
     * Uses the new chat API endpoint for better integration with the unified message store
     */
    async actionGetGroupDiscussionMessages (limit = 50, from?: string) {
      try {
        if (this.group?.slug) {
          console.log('Getting group discussion messages for:', this.group.slug)

          // Make the API call using the new chatApi endpoint
          const res = await chatApi.getGroupMessages(this.group.slug, limit, from)

          console.log('Response from getGroupMessages:', {
            messageCount: res.data.messages?.length || 0,
            roomId: res.data.roomId,
            hasFirstMessage: res.data.messages?.length > 0,
            firstMessageRoomId: res.data.messages?.length > 0 ? res.data.messages[0].room_id : null
          })

          // Store the roomId in the group object if it's provided
          if (res.data.roomId && this.group) {
            console.log('Found roomId in API response:', res.data.roomId)
            this.group.roomId = res.data.roomId
          }

          // If we have messages but no roomId, try to extract it from the messages
          if (!this.group.roomId && res.data.messages && res.data.messages.length > 0) {
            // Check all messages for a roomId or room_id property
            for (const message of res.data.messages) {
              // Try both property naming conventions
              const extractedRoomId = message.roomId || message.room_id
              if (extractedRoomId) {
                console.log('Extracted roomId from message:', extractedRoomId)
                this.group.roomId = extractedRoomId
                break
              }
            }
          }

          return res.data
        }
        return { messages: [], end: '' }
      } catch (err) {
        console.error('Failed to get group discussion messages:', err)

        // Check for the specific "not implemented" error from the backend
        if (err.response?.data?.message?.includes('not implemented') ||
            (typeof err.message === 'string' && err.message.includes('not implemented'))) {
          console.log('Group discussion functionality not implemented yet on the backend')
          throw new Error('Group discussion functionality not implemented yet')
        } else {
          error('Failed to get group discussion messages')
        }

        return { messages: [], end: '' }
      }
    },

    /**
     * Delete a message from the group discussion
     * Uses the legacy API for now until the chat API is updated to support deletion
     */
    async actionDeleteGroupDiscussionMessage (messageId: number): Promise<number | undefined> {
      try {
        if (this.group?.slug) {
          const res = await groupsApi.deleteDiscussionMessage(this.group.slug, messageId)
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to delete group discussion message')
      }
    },

    /**
     * Update a message in the group discussion
     * Uses the legacy API for now until the chat API is updated to support updates
     */
    async actionUpdateGroupDiscussionMessage (messageId: number, message: string): Promise<number | undefined> {
      try {
        if (this.group?.slug) {
          const res = await groupsApi.updateDiscussionMessage(this.group.slug, messageId, message)
          return res.data.id
        }
      } catch (err) {
        console.log(err)
        error('Failed to update group discussion message')
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
