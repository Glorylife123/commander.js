import { Command } from "../src/index.js";

const program = new Command()
  .name("release")
  .description("A richer example for deployment and release operations")
  .showHelpAfterError();

program
  .command("ship")
  .alias("deploy")
  .description("Ship an artifact to the target environment")
  .arguments("<artifact> [build]")
  .requiredOption("-t, --token <value>", "deployment token")
  .option("-e, --env [name]", "target environment", "production")
  .option("--tag <name...>", "release tags")
  .option("--no-color", "disable colorized deployment output")
  .option("-v, --verbose", "enable verbose output")
  .action(async (artifact, build, options) => {
    await new Promise((resolve) => setTimeout(resolve, 10));

    const summary = {
      artifact,
      build: build ?? "latest",
      environment: options.env === true ? "production" : options.env,
      tags: options.tag ?? [],
      color: options.color,
      verbose: Boolean(options.verbose),
      tokenLength: options.token.length
    };

    console.log(JSON.stringify(summary));
  });

await program.parseAsync(process.argv);
