declare namespace Cypress {
    interface Chainable {
        login(username: string, password: string): Chainable<void>;
    }
}
