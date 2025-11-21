import { GroupEntity, GroupMemberEntity, GroupPermission, GroupPermissionEntity, GroupRole, GroupRoleEntity, GroupVisibility, UserEntity } from '../../../src/types'

describe('GroupPage', () => {
  const group = {
    id: 1,
    slug: 'group-one',
    name: 'Group One',
    description: 'Description for group one'
  }

  describe('when the group visibility is public', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: {
          ...group,
          visibility: GroupVisibility.Public
        } as GroupEntity
      }).as('getGroup')
      cy.intercept('GET', `/api/groups/${group.slug}/recommended-events`, {
        statusCode: 200,
        body: [{ id: 1, name: 'Event One', slug: 'event-one' }]
      }).as('getRecommendedEvents')
      cy.intercept('POST', '/api/auth/login', {
        statusCode: 200
      }).as('login')

      cy.intercept('POST', `/api/groups/${group.slug}/join`, {
        statusCode: 200,
        body: {
          id: 1,
          user: { id: 1, email: 'test@test.com' } as UserEntity,
          group: { id: group.id, slug: group.slug } as GroupEntity,
          groupRole: {
            id: 1,
            name: GroupRole.Member,
            groupPermissions: [
              { id: 1, name: GroupPermission.SeeDiscussions } as GroupPermissionEntity,
              { id: 2, name: GroupPermission.MessageDiscussion } as GroupPermissionEntity
            ]
          } as unknown as GroupRoleEntity
        } as unknown as GroupMemberEntity
      }).as('joinGroup')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
        cy.wait('@getRecommendedEvents')
      })
    })

    it('should display the group', () => {
      cy.dataCy('group-name').should('be.visible')
    })

    it('should display the join group button', () => {
      cy.dataCy('join-group-button').should('be.visible')
    })

    it('should display login popup when clicking on join group button', () => {
      cy.dataCy('join-group-button').click()
      cy.dataCy('login-form').should('be.visible')
    })

    it('should join and leave the group when clicking on join group button', () => {
      cy.dataCy('join-group-button').click()
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
      cy.dataCy('join-group-button').should('be.visible').click()
      cy.dataCy('welcome-group-dialog').should('be.visible').withinDialog(() => {
        cy.dataCy('welcome-group-dialog-member').should('be.visible')
        cy.dataCy('welcome-group-dialog-close').should('be.visible').click()
      })
      cy.dataCy('leave-group-button-dropdown').should('be.visible').click()
      cy.dataCy('leave-group-button').should('be.visible').click()

      // click escape to close the dialog
    })

    it('should display the recommended events', () => {
      cy.dataCy('recommended-events-component').should('be.visible')
    })

    it('should display the group events page', () => {
      cy.visit(`/groups/${group.slug}/events`)
      cy.dataCy('group-events-page').should('be.visible')
    })

    it('should display the group members page', () => {
      cy.visit(`/groups/${group.slug}/members`)
      cy.dataCy('group-members-page').should('be.visible')
    })

    it('should display the group discussions page', () => {
      cy.visit(`/groups/${group.slug}/discussions`)
      cy.dataCy('group-discussions-page').should('be.visible')
    })
  })

  describe('when the group visibility is private', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: { ...group, visibility: GroupVisibility.Private } as GroupEntity
      }).as('getGroup')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the request to join group button', () => {
      cy.dataCy('join-group-button').should('be.visible')
    })

    it('should display the private group content', () => {
      cy.dataCy('private-group-content').should('be.visible')
    })

    it('should show not permission page when trying to access to group events page', () => {
      cy.visit(`/groups/${group.slug}/events`)
      cy.dataCy('private-group-content').should('be.visible')
    })

    it('should show not permission page when trying to access to group members page', () => {
      cy.visit(`/groups/${group.slug}/members`)
      cy.dataCy('private-group-content').should('be.visible')
    })

    it('should show not permission page when trying to access to group discussions page', () => {
      cy.visit(`/groups/${group.slug}/discussions`)
      cy.dataCy('private-group-content').should('be.visible')
    })

    it('should wait for approval and leave the group', () => {
      cy.dataCy('join-group-button').click()
      cy.dataCy('login-form').should('be.visible')
      cy.dataCy('login-email').type(Cypress.env('APP_TESTING_USER_EMAIL'))
      cy.dataCy('login-password').type(Cypress.env('APP_TESTING_USER_PASSWORD'))
      cy.dataCy('login-submit').click()
      //  page reload

      // cy.dataCy('join-group-button').should('be.visible').click()
      // a dialog with pending message should be displayed
      // cy.dataCy('welcome-group-dialog').should('be.visible').within(() => {
      //   cy.dataCy('welcome-group-dialog-pending-approval').should('be.visible')
      //   cy.dataCy('welcome-group-dialog-close').should('be.visible').click()
      // })
      // cy.dataCy('leave-group-button-dropdown').should('be.visible').click()
      // cy.dataCy('leave-group-button').should('be.visible').click()
      // cy.dataCy('join-group-button').should('be.visible')
    })
  })

  describe('when the group visibility is authenticated', () => {
    beforeEach(() => {
      cy.intercept('GET', `/api/groups/${group.slug}`, {
        statusCode: 200,
        body: {
          ...group,
          visibility: GroupVisibility.Unlisted
        } as GroupEntity
      }).as('getGroup')

      cy.visit(`/groups/${group.slug}`).then(() => {
        cy.wait('@getGroup')
      })
    })

    it('should display the auth group content', () => {
      cy.dataCy('auth-group-content').should('be.visible')
    })

    it('should show please authenticate page when trying to access to group events page', () => {
      cy.visit(`/groups/${group.slug}/events`).then(() => {
        cy.dataCy('auth-group-content').should('be.visible')
      })
    })
  })
})
