import { defineConfig } from "cypress";
import fs from "fs";
import path from "path";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    downloadsFolder: "cypress/downloads",
    screenshotOnRunFailure: true,
    video: false,
    setupNodeEvents(on, config) {
      on("task", {
        listDownloads() {
          const dir = config.downloadsFolder!;
          if (!fs.existsSync(dir)) return [];
          return fs.readdirSync(dir);
        },
        clearDownloads() {
          const dir = config.downloadsFolder!;
          if (!fs.existsSync(dir)) return null;
          for (const f of fs.readdirSync(dir)) {
            fs.rmSync(path.join(dir, f), { force: true });
          }
          return null;
        },
        findDownloadedFile(partialName: string) {
          const dir = config.downloadsFolder || "cypress/downloads";
          if (!fs.existsSync(dir)) return null;
          const files = fs.readdirSync(dir);
          const match = files.find((f) => f.includes(partialName));
          return match ? path.join(dir, match) : null;
        },
        readFileIfExists(filePath: string) {
          try {
            return fs.readFileSync(filePath, "utf-8");
          } catch {
            return null;
          }
        },
      });
      return config;
    },
  },
});

