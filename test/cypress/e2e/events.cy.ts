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

    cy.visit('/events')
  })

  it('--- fetches the list of events', () => {
    cy.wait('@getEvents')
  })

  it('--- fetches the list of categories', () => {
    cy.wait('@getCategories')
  })
})
