import { Command } from "../src/index.js";

const program = new Command()
  .name("release")
  .description("A richer example for deployment and release operations");

program
  .command("ship <artifact>")
  .alias("deploy")
  .description("Ship an artifact to the target environment")
  .requiredOption("-t, --token <value>", "deployment token")
  .option("-e, --env [name]", "target environment", "production")
  .option("-v, --verbose", "enable verbose output")
  .action(async (artifact, options) => {
    await new Promise((resolve) => setTimeout(resolve, 10));

    const summary = {
      artifact,
      environment: options.env === true ? "production" : options.env,
      verbose: Boolean(options.verbose),
      tokenLength: options.token.length
    };

    console.log(JSON.stringify(summary));
  });

await program.parseAsync(process.argv);
