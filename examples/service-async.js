import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "../src/index.js";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));

const check = new Command("check")
  .description("run an external async-friendly health check")
  .executableFile(path.join(exampleDir, "service-async-check.js"));

const program = new Command()
  .name("service-async")
  .description("Async main command that delegates to a standalone executable subcommand")
  .addCommand(check)
  .showHelpAfterError();

await program.parseAsync(process.argv);
