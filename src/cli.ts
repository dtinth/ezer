import { defineCommand, runMain } from "citty";

const main = defineCommand({
  meta: {
    name: "ezer",
    description: "A robot companion for AI agents",
  },
  run() {
    console.log("=== EZER ===");
    console.log("I am ezer, a robot companion for AI agents.");
    console.log("");
    console.log("Not yet implemented. Coming soon!");
  },
});

runMain(main);
