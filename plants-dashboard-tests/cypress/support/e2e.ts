/// <reference types="cypress" />

// Ignore uncaught exceptions to keep tests stable
Cypress.on("uncaught:exception", () => false);

// Optional: import custom commands here
// import "./commands";
import "./bdd";
