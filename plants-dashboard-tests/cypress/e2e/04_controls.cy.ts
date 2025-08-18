import { DashboardPage } from "../pages/Dashboard.po";
import { waitForAppReady, waitForAssets } from "../pages/Api.waits";
import { Given, When, Then, And } from "../support/bdd";

describe("Controls - Send simple commands", () => {
  const page = new DashboardPage();

  it("acknowledges start/stop/setpoint with a status label", () => {
    Given("the dashboard and API are running with data", () => {
      waitForAppReady();
      waitForAssets();
    });

    When("I open the Controls tab and select a plant", () => {
      page.visit().goTo("controls");
      // click on map
      page.clickFirstPin();
    });

    And("I press Start", () => {
      page.btnStart().click();
    });
    Then("I see the started status", () => {
      page.cmdStatus().should("contain.text", "started");
    });

    And("I press Stop", () => {
      page.btnStop().click();
    });
    Then("I see the stopped status", () => {
      page.cmdStatus().should("contain.text", "stopped");
    });

    And("I press Setpoint", () => {
      page.btnSetpoint().click();
    });
    Then("I see the setpoint updated status", () => {
      page.cmdStatus().should("contain.text", "setpoint updated");
    });
  });
});
