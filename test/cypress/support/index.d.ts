declare namespace Cypress {
    interface Chainable {
        login(username: string, password: string): Chainable<void>;
        loginPage(username: string, password: string): Chainable<void>;
        logout(): Chainable<void>;
        loginBluesky(username: string, password: string): Chainable<void>;
    }
}
