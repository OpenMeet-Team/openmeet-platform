import { EventPaginationEntity } from 'src/types'

describe('EventsPage', () => {
  beforeEach(() => {
    cy.intercept('GET', '/api/categories', {}).as('getCategories')
    cy.intercept('GET', '/api/events', {
      statusCode: 200,
      body: {
        data: [
          {
            id: 1,
            name: 'Event One',
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
})
