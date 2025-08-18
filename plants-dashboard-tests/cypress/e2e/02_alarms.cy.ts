import { DashboardPage } from "../pages/Dashboard.po";
import { waitForAppReady, waitForAssets } from "../pages/Api.waits";
import { Given, When, Then, And } from "../support/bdd";

describe("Alarms - Load on demand", () => {
  const page = new DashboardPage();

  it("loads current alarms and shows what is available", () => {
    Given("the dashboard and API are running with data", () => {
      waitForAppReady();   // waits for http://localhost:5173/
      waitForAssets();     // waits for GET /assets to have items
    });

    When("I open the Alarms tab", () => {
      page.visit().goTo("alarms");
    });

    And("I request the current alarms", () => {
      cy.intercept("GET", "http://localhost:8000/alarms*").as("alarms");
      page.loadAlarmsButton().should("exist");
      page.clickLoadAlarms();
      cy.wait("@alarms");  // ensure the response arrived
    });

    Then("I see either an alarm list or a 'No active alarms.' message", () => {
      page.expectAlarmsLoaded(); // resilient: accepts either case
    });

    // And("I see the live refresh hint", () => {
    //   page.liveLabel().should("exist");
    // });
  });
});


