import { DashboardPage } from "../pages/Dashboard.po";
import { waitForAppReady, waitForAssets } from "../pages/Api.waits";
import { Given, When, Then, And } from "../support/bdd";

describe("Trends - Visualize recent telemetry", () => {
  const page = new DashboardPage();

  it("shows NOx, Pₑ and Efficiency curves for a selected plant", () => {
    Given("the dashboard and API are running with data", () => {
      waitForAppReady();
      waitForAssets();
    });

    When("I open the Trends tab and select a plant", () => {
      page.visit().goTo("trends");
      // click on map
      page.clickFirstPin();
    });

    Then("I see the NOx chart", () => {
      page.chartNOx().should("be.visible");
    });

    And("I see the electrical power chart", () => {
      page.chartPe().should("be.visible");
    });

    And("I see the efficiency chart", () => {
      page.chartEff().should("be.visible");
    });
  });
});
