// cypress/pages/Dashboard.po.ts
export class DashboardPage {
  visit() {
    cy.visit("/");
    return this;
  }

  // Tabs
  tab(name: "overview" | "alarms" | "trends" | "controls" | "reports") {
    return cy.get(`[data-testid="tab-${name}"]`);
  }
  goTo(name: "overview" | "alarms" | "trends" | "controls" | "reports") {
    this.tab(name).click();
    return this;
  }

  // Filter
  setFilter(text: string) {
    cy.get('input[placeholder="Filter by name…"]').clear().type(text);
    return this;
  }
 
   // Dropdown
   sortDropdown() {
     return cy.get("select.text-xs");
  }

  // Chart title
  chartTitle() {
    return cy.get("h3.text-sm.font-medium.text-slate-700"); 
  }

   // Graph
   chartSvg() {
    return cy.get("svg");
  }

  // Assets list
  assetButtonByIdPrefix(prefix: string) {
    return cy.get(`[data-testid^="asset-${prefix}"]`);
  }
  firstAsset() {
    return cy.get('[data-testid^="asset-"]').first();
  }
  selectFirstAsset() {
    this.firstAsset().click();
    return this;
  }

  // Map pins (Leaflet circle markers)
  mapPins() {
    return cy.get(".leaflet-interactive");
  }
  clickFirstPin() {
    this.mapPins().first().click({ force: true });
    return this;
  }

  // Alarms
  loadAlarmsButton() {
    return cy.get('[data-testid="load-alarms"]');
  }
  clickLoadAlarms() {
    this.loadAlarmsButton().click();
    return this;
  }
  liveLabel() {
    // Active alarm
    return cy.contains(/auto-refresh ~15s/i);
  }
  noActiveAlarmsText() {
    return cy.contains("No active alarms.");
  }

  /**
   * Waits until either:
   *  - "No active alarms." is visible
   *  - OR at least one <li> item exists inside any alarms list
   * Retries up to ~10s.
   */
  expectAlarmsLoaded() {
    const deadline = Date.now() + 10_000;

    const tryCheck = () => {
      cy.get("body").then(($body) => {
        const text = $body.text();
        const hasNoActive = text.includes("No active alarms.");
        const liCount = $body.find("ul li").length;

        if (hasNoActive || liCount > 0) {
          expect(true).to.be.true;
          return;
        }

        if (Date.now() > deadline) {
          throw new Error(
            "expected at least one alarm item or 'No active alarms.' after clicking Load"
          );
        }

        cy.wait(500).then(tryCheck);
      });
    };

    tryCheck();
    return this;
  }

  // Controls
  btnStart() {
    return cy.contains("button", /start/i);
  }
  btnStop() {
    return cy.contains("button", /stop/i);
  }
  btnSetpoint() {
    return cy.contains("button", /setpoint/i);
  }
  cmdStatus() {
    return cy.get('[data-testid="cmd-status"]');
  }

  // Trends
  chartNOx() {
    return cy.contains("NOx (ppm)");
  }
  chartPe() {
    return cy.contains("Pₑ (MW)");
  }
  chartEff() {
    return cy.contains("Efficiency (%)");
  }

  // Reports
  exportCsvButton() {
    return cy.get('[data-testid="export-csv"]');
  }
}


