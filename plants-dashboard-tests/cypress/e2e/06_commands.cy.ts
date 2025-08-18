import { DashboardPage } from "../pages/Dashboard.po";
import { waitForAppReady, waitForAssets } from "../pages/Api.waits";
import { Given, When, Then } from "../support/bdd";

describe("Controls – Command status auto-clear after 3s", () => {
  const page = new DashboardPage();

  it("shows Stop command status briefly, then clears", () => {
    Given("the dashboard and API are running with data", () => {
      waitForAppReady();
      waitForAssets();
      cy.clock()
    });

    When("I send a Stop command", () => {
      page.visit().goTo("controls");
      // click on map
      page.clickFirstPin();
      page.btnStop().click();
    });

    Then("the status label appears and disappears after 3s", () => {
      page.cmdStatus().should("contain.text", "stopped");

      // fast-forward 3s virtual time
      cy.tick(3000);

      page.cmdStatus().should("not.exist");

     // restore the clock
     cy.clock().then((clock) => {
     clock.restore()
      })
      
    });
  });
});
