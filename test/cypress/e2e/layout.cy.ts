describe('Footer', () => {
  it('should have mail newsletter signup', () => {
    cy.intercept('POST', 'https://api.hsforms.com/submissions/v3/integration/submit/47380304/7aa8f331-96a9-48ec-a787-0c894dc5f85e').as('mailSignup')

    cy.visit('/auth/login').then(() => {
      cy.dataCy('mail-signup').should('be.visible').type('test@test.com')
      cy.dataCy('mail-signup-submit').should('be.visible').click()
      cy.wait('@mailSignup').then((res) => {
        expect(res.response?.statusCode).to.eq(200)
      })
    })
  })
})
