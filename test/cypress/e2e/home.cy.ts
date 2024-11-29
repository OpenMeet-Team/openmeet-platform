describe('HomePage', () => {
  describe('User Home', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/home/guest', {
        statusCode: 200,
        fixture: 'home/guest.json'
      }).as('getGuestHome')
      cy.intercept('GET', '/api/home/user', {
        statusCode: 200,
        fixture: 'home/user.json'
      }).as('getUserHome')
      cy.visit('/').then(() => {
        cy.wait('@getGuestHome')
        cy.login(Cypress.env('APP_TESTING_ADMIN_EMAIL'), Cypress.env('APP_TESTING_ADMIN_PASSWORD'))
      })
    })

    it('should have home user page components', () => {
      cy.wait('@getUserHome')
      cy.dataCy('home-user-organized-groups-item-component').should('be.visible')
      cy.dataCy('home-user-upcoming-events-item-component').should('be.visible')
      cy.dataCy('home-user-interests-item-component').should('be.visible')
      cy.dataCy('home-user-recent-event-drafts-item-component').should('be.visible')
      cy.dataCy('home-user-member-groups-item-component').should('be.visible')
    })
  })

  describe('Guest Home', () => {
    beforeEach(() => {
      cy.intercept('GET', '/api/home/guest', {
        statusCode: 200,
        fixture: 'home/guest.json'
      }).as('getGuestHome')
      cy.visit('/').then(() => {
        cy.wait('@getGuestHome')
      })
    })

    it('should have logo', () => {
      cy.dataCy('header-logo-component').should('be.visible')
    })

    it('should have featured groups', () => {
      cy.dataCy('home-featured-groups').should('be.visible')
    })

    it('should have upcoming events', () => {
      cy.dataCy('home-upcoming-events').should('be.visible')
    })

    it('should have categories', () => {
      cy.dataCy('home-categories').should('be.visible')
    })

    it('should have interests', () => {
      cy.dataCy('home-interests').should('be.visible')
    })
  })
})
