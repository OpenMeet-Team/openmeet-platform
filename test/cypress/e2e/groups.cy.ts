import { GroupPaginationEntity } from 'src/types'

describe('GroupsPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/categories', {
      statusCode: 200,
      body: [
        {
          id: 1,
          name: 'Category One'
        }
      ]
    }).as('getCategories')
    cy.intercept('GET', '/api/groups', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            slug: 'group-one',
            name: 'Group One',
            description: 'Description for group one'
          }
        ],
        totalPages: 1,
        page: 1,
        total: 10
      } as GroupPaginationEntity
    }).as('getGroups')

    cy.visit('/groups').then(() => {
      cy.wait('@getCategories')
      cy.wait('@getGroups')
    })
  })

  it('should fetch the list of groups', () => {
    cy.dataCy('groups-page').should('be.visible')
    cy.dataCy('groups-item').should('be.visible')
    cy.dataCy('location-filter').should('be.visible')
    cy.dataCy('categories-filter').should('be.visible')
  })

  it('should reset location filter', () => {
    cy.intercept('GET', 'https://nominatim.openstreetmap.org/search?q=Location&format=json').as('getLocation')
    cy.dataCy('location-filter').should('be.visible').type('Location')
    // cy.wait('@getLocation')
    cy.dataCy('location-filter').withinSelectMenu({
      fn: () => {
        cy.dataCy('location-item-label').contains('Location').click()
      }
    })

    cy.dataCy('groups-reset-filters').should('be.visible').click()
    cy.testRoute('/groups')
  })

  it('should reset categories filter', () => {
    cy.dataCy('categories-filter').should('be.visible').click()
    cy.dataCy('categories-filter').withinSelectMenu({
      fn: () => {
        cy.get('.q-item').first().click()
      }
    })
    cy.dataCy('groups-reset-filters').should('be.visible').click()
    cy.testRoute('/groups')
  })

  it('should navigate to the group page', () => {
    cy.dataCy('groups-page').should('be.visible')
    cy.dataCy('groups-item-image').first().click()
    cy.testRoute('/groups/group-one--b')
  })

  it('should display the login form', () => {
    cy.dataCy('header-mobile-menu').click()
    cy.dataCy('add-group-button').should('be.visible').click()
    cy.dataCy('login-form').should('be.visible')
  })

  describe('User creates a group', () => {
    beforeEach(() => {
      cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    })

    it('should display the add group form', () => {
      cy.dataCy('header-mobile-menu').click()
      cy.dataCy('add-group-button').should('be.visible').click()
      cy.dataCy('group-form').should('be.visible')
    })

    it('should create a group', () => {
      cy.intercept('POST', '/api/groups', {
        statusCode: 200,
        body: {
          id: 2,
          slug: 'group-two'
        }
      }).as('createGroup')
      cy.dataCy('header-mobile-menu').click()
      cy.dataCy('add-group-button').should('be.visible').click()
      cy.dataCy('group-form').should('be.visible')
      cy.dataCy('group-create').click()

      cy.dataCy('group-name').type('Group Two')
      cy.dataCy('group-create').click()

      cy.dataCy('group-description').type('Description for group two')

      // TODO: fix this, for now categories are not required
      // cy.dataCy('group-categories').should('be.visible').click()
      // cy.dataCy('group-categories').withinSelectMenu({
      //   fn: () => {
      //     cy.get('.q-item').contains('Category One').click()
      //   }
      // })
      // cy.dataCy('group-create').click()
      cy.dataCy('group-location').should('be.visible').type('Location')
      cy.dataCy('group-location').withinSelectMenu({
        fn: () => {
          cy.dataCy('location-item-label').first().click()
        }
      })
      // TODO: fix this, for now image is not uploaded
      // cy.dataCy('upload-component').should('be.visible').within(() => {
      //   console.log(cy.get('input[type=file]'))
      //   cy.get('input[type=file]').selectFile({
      //     contents: Cypress.Buffer.from('image contents here', 'base64'),
      //     fileName: 'image.png',
      //     mimeType: 'image/png',
      //     lastModified: Date.now()
      //   })
      // })
      cy.dataCy('group-visibility').should('be.visible').click()
      cy.dataCy('group-visibility').withinSelectMenu({
        fn: () => {
          cy.get('.q-item').first().click()
        }
      })
      cy.dataCy('group-create').click()
      // cy.wait('@createGroup')
      cy.testRoute('/groups/group-two--c')

      // cy.dataCy('group-form').should('not.be.visible')
      // cy.testRoute('/groups/group-two--b')
    })
  })
})
