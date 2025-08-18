// cypress/pages/Api.waits.ts

/** Wait until the frontend (baseUrl) returns 200 on "/" */
export function waitForAppReady(
  timeoutMs = 30_000,
  intervalMs = 1_000,
  baseUrl = (Cypress.config("baseUrl") as string) || "http://localhost:5173"
) {
  const deadline = Date.now() + timeoutMs;

  function check(): Cypress.Chainable<void> {
    return cy
      .request({
        url: baseUrl + "/",
        method: "GET",
        failOnStatusCode: false, // retry manually if not 200
      })
      .then((res) => {
        if (res.status === 200) return;
        if (Date.now() > deadline) {
          throw new Error(
            `Frontend not ready at ${baseUrl}/ (status=${res.status}). Ensure the dev server is running.`
          );
        }
        return cy.wait(intervalMs).then(check);
      });
  }

  return check();
}

/** Poll /assets until at least `min` assets exist */
export function waitForAssets(
  min = 3,
  timeoutMs = 30_000,
  intervalMs = 1_000,
  apiBase = "http://localhost:8000"
) {
  const deadline = Date.now() + timeoutMs;

  function check(): Cypress.Chainable<void> {
    return cy
      .request({
        url: `${apiBase}/assets`,
        method: "GET",
        failOnStatusCode: false,
      })
      .then((res) => {
        const ok = res.status === 200 && Array.isArray(res.body) && res.body.length >= min;
        if (ok) return;

        if (Date.now() > deadline) {
          const len = Array.isArray(res.body) ? res.body.length : "n/a";
          throw new Error(
            `waitForAssets timed out after ${timeoutMs}ms. status=${res.status}, body.length=${len} from ${apiBase}/assets`
          );
        }

        return cy.wait(intervalMs).then(check);
      });
  }

  return check();
}



