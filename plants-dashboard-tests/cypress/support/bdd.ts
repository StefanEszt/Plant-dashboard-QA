// cypress/support/bdd.ts
type StepFn = () => void | Cypress.Chainable<unknown>;

export function Given(text: string, fn: StepFn) {
  cy.log(`Given ${text}`);
  return fn();
}
export function When(text: string, fn: StepFn) {
  cy.log(`When ${text}`);
  return fn();
}
export function Then(text: string, fn: StepFn) {
  cy.log(`Then ${text}`);
  return fn();
}
export function And(text: string, fn: StepFn) {
  cy.log(`And ${text}`);
  return fn();
}
