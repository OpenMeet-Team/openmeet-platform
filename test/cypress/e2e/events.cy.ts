import { EventPaginationEntity } from '../../../src/types'

describe('EventsPage', () => {
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
    cy.intercept('GET', '/api/events', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            name: 'Event One',
            slug: 'event-one',
            description: 'Description for event one'
          }
        ],
        totalPages: 1,
        page: 1,
        total: 10
      } as EventPaginationEntity
    }).as('getEvents')

    cy.visit('/events').then(() => {
      cy.wait('@getEvents')
      cy.wait('@getCategories')
    })
  })

  it('should fetch the list of events', () => {
    cy.dataCy('events-page').should('be.visible')
    cy.dataCy('events-item').should('be.visible')
    cy.dataCy('events-date-filter').should('be.visible')
    cy.dataCy('events-type-filter').should('be.visible')
    cy.dataCy('categories-filter').should('be.visible')
    cy.dataCy('location-filter').should('be.visible')
  })

  describe('User creates an event', () => {
    beforeEach(() => {
      cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
    })

    it('should display the add event form', () => {
      cy.dataCy('header-nav-add-event-button').should('be.visible').click()
      cy.dataCy('event-form-dialog').should('be.visible')
    })

    it('should create an event', () => {
      cy.intercept('GET', '/api/groups/me', {
        statusCode: 200,
        body: [
          {
            id: 1,
            name: 'Group One'
          }
        ]
      }).as('getMyGroups')

      cy.intercept('POST', '/api/events', {
        statusCode: 200,
        body: {
          id: 2,
          name: 'Event Two',
          slug: 'event-two'
        }
      }).as('createEvent')

      cy.intercept('POST', '/api/v1/files/upload', {
        statusCode: 201,
        body: {
          id: 1,
          path: 'path/to/image.png'
        }
      }).as('uploadImage')

      cy.intercept('GET', 'https://nominatim.openstreetmap.org/search?q=Location&format=json&limit=5&accept-language=en', {
        statusCode: 200,
        body: [
          {
            display_name: 'Location, Country',
            lat: '12.3456',
            lon: '12.3456'
          }
        ]
      }).as('getLocations')

      cy.dataCy('header-nav-add-event-button').should('be.visible').click()
      cy.wait('@getMyGroups').then(() => {
        // cy.dataCy('event-publish').click()

        cy.dataCy('event-name-input').should('be.visible').type('Event Two')

        cy.dataCy('event-group').should('be.visible')
        cy.dataCy('event-description').type('Description for event two')

        cy.dataCy('event-start-date').type('2024-12-06T21:00:00.000Z')
        cy.dataCy('event-set-end-time').click()
        cy.dataCy('event-end-date').type('2024-12-06T22:00:00.000Z')

        cy.dataCy('event-image').within(() => {
          cy.get('input[type=file]').selectFile({
            contents: Cypress.Buffer.from('image contents here', 'base64'),
            fileName: 'image.png',
            mimeType: 'image/png',
            lastModified: Date.now()
          })

          cy.wait('@uploadImage')

          // cy.dataCy('cropper-confirm').click()
        })

        cy.dataCy('event-location').should('be.visible').type('Location')
        cy.wait('@getLocations')
        cy.dataCy('event-location').withinSelectMenu({
          fn: () => {
            cy.dataCy('location-item-label').first().click()
          }
        })

        cy.dataCy('event-categories').should('be.visible')
        // cy.dataCy('event-categories').click()
        // cy.dataCy('event-categories').withinSelectMenu({
        //   fn: () => {
        //     cy.get('.q-item').first().click()
        //   }
        // })

        cy.dataCy('event-max-attendees').click()
        cy.dataCy('event-max-attendees-input').should('be.visible').type('10')

        cy.dataCy('event-require-approval').click()
        cy.dataCy('event-approval-question').type('Approval question')

        cy.dataCy('event-visibility').should('be.visible').click()
        cy.dataCy('event-visibility').withinSelectMenu({
          fn: () => {
            cy.get('.q-item').first().click()
          }
        })

        cy.dataCy('event-publish').click()
        cy.wait('@createEvent').then((e) => {
          console.log('e', e)
          cy.testRoute('/events/event-two')
        })
      })
    })
  })
})
