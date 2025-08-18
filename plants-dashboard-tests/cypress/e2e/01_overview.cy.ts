import { DashboardPage } from "../pages/Dashboard.po";
import { waitForAppReady, waitForAssets } from "../pages/Api.waits";
import { Given, When, Then, And } from "../support/bdd";

describe("Overview - Fleet snapshot and filtering", () => {
  const page = new DashboardPage();

  it("shows fleet KPIs and lets me filter assets", () => {
    Given("the dashboard and API are running with data", () => {
      waitForAppReady();
      waitForAssets();
    });

    When("I open the Overview tab", () => {
      page.visit().goTo("overview");
    });

    Then("I see the fleet status pie and the top-10 chart", () => {
      cy.contains("Fleet Status").should("be.visible");
      cy.contains("Top 10 — NOx").should("be.visible");
    });

    And("I can filter the assets by name and see the list update", () => {
      page.firstAsset().invoke("text").should("match", /vienna/i);
      page.setFilter("Budapest");
      page.firstAsset().invoke("text").should("match", /budapest/i);
      page.firstAsset().invoke("text").should("not.match", /vienna/i);
    });
    
    And("I select Efficiency in the sorting dropdown", () => {
      page.sortDropdown().select("health"); // selects Efficiency (%)
    });

    Then("the chart title updates accordingly", () => {
      page.chartTitle().should("contain.text", "Top 10 — Efficiency");
      page.chartSvg().should("exist").and("be.visible"); // chart is drawn
    });
    
  });
});
