import { Command } from "../src/index.js";

const program = new Command()
  .name("string-util")
  .description("CLI to some JavaScript string utilities")
  .helpOption("-H, --HELP", "display help for command")
  .showHelpAfterError();

const splitCommand = new Command("split")
  .summary("Split a string into substrings and display as an array")
  .arguments("[string]")
  .option("--first", "display just the first substring")
  .option("-s, --separator <char>", "separator character", ",")
  .option("-l, --list <item...>", "provide items directly instead of splitting text")
  .action((input, options) => {
    const result = options.list ?? (input ? input.split(options.separator, options.first ? 1 : undefined) : []);
    console.log(JSON.stringify(result));
  });

program.addCommand(splitCommand);

program.parse(process.argv);
