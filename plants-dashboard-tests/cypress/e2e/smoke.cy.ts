describe("Smoke & Navigation", () => {
  it("loads the dashboard and shows tabs", () => {
    cy.visit("/");
    cy.contains("Power Plant Fleet").should("exist"); // header text in your app
    ["Overview", "Alarms", "Trends", "Controls", "Reports"].forEach((t) => {
      cy.get(`[data-testid="tab-${t.toLowerCase()}"]`).should("exist");
    });
  });

  it("shows map pins and opens a popup", () => {
    cy.visit("/");
    // Leaflet circle markers have class 'leaflet-interactive'
    cy.get(".leaflet-interactive").its("length").should("be.gte", 3);
    cy.get(".leaflet-interactive").first().click({ force: true });
    cy.contains("ID:").should("exist");
  });
});
