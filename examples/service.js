import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "../src/index.js";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));

const program = new Command()
  .name("service")
  .description("Main command that delegates to standalone executable subcommands")
  .executableDir(exampleDir)
  .showHelpAfterError();

program.command("start <name>", "start a service with an external script");

program.parse(process.argv);
