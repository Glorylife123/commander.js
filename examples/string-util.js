import { Command } from "../src/index.js";

const program = new Command()
  .name("string-util")
  .description("CLI to some JavaScript string utilities");

program
  .command("split <string>")
  .summary("Split a string into substrings and display as an array")
  .option("--first", "display just the first substring")
  .option("-s, --separator <char>", "separator character", ",")
  .action((input, options) => {
    const limit = options.first ? 1 : undefined;
    console.log(JSON.stringify(input.split(options.separator, limit)));
  });

program.parse(process.argv);
