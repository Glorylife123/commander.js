import test from "node:test";
import assert from "node:assert/strict";

import { Command } from "../src/index.js";

test("parses boolean and value options", () => {
  const program = new Command()
    .option("--first", "first only")
    .option("-s, --separator <char>", "separator", ",")
    .argument("<input>");

  program.parse(["--first", "-s", "/", "a/b/c"], { from: "user" });

  assert.deepEqual(program.opts(), { first: true, separator: "/" });
  assert.deepEqual(program.args, ["a/b/c"]);
});

test("supports subcommands with actions", () => {
  let result = null;

  const program = new Command().name("string-util");
  program
    .command("split <input>")
    .option("--first", "first only")
    .option("-s, --separator <char>", "separator", ",")
    .action((input, options) => {
      const limit = options.first ? 1 : undefined;
      result = input.split(options.separator, limit);
    });

  program.parse(["split", "--first", "-s", "/", "a/b/c"], { from: "user" });

  assert.deepEqual(result, ["a"]);
});

test("supports command aliases", () => {
  let result = null;
  const program = new Command().name("string-util");

  program
    .command("split <input>")
    .alias("sp")
    .option("-s, --separator <char>", "separator", ",")
    .action((input, options) => {
      result = input.split(options.separator);
    });

  program.parse(["sp", "-s", "/", "a/b/c"], { from: "user" });

  assert.deepEqual(result, ["a", "b", "c"]);
});

test("supports long option inline values", () => {
  const program = new Command()
    .option("-s, --separator <char>", "separator", ",")
    .argument("<input>");

  program.parse(["--separator=/", "a/b/c"], { from: "user" });

  assert.deepEqual(program.opts(), { separator: "/" });
  assert.deepEqual(program.args, ["a/b/c"]);
});

test("supports optional option values", () => {
  const program = new Command().option("--color [mode]", "color mode");

  program.parse(["--color"], { from: "user" });
  assert.deepEqual(program.opts(), { color: true });

  program.parse(["--color", "always"], { from: "user" });
  assert.deepEqual(program.opts(), { color: "always" });
});

test("supports combined short boolean options", () => {
  const program = new Command()
    .option("-a, --all", "all")
    .option("-l, --long", "long format")
    .option("-h, --human", "human readable");

  program.parse(["-alh"], { from: "user" });

  assert.deepEqual(program.opts(), { all: true, long: true, human: true });
});

test("supports short option value attached to flag", () => {
  const program = new Command()
    .option("-p, --port <number>", "port")
    .argument("<host>");

  program.parse(["-p3000", "localhost"], { from: "user" });

  assert.deepEqual(program.opts(), { port: "3000" });
  assert.deepEqual(program.args, ["localhost"]);
});

test("supports variadic arguments", () => {
  const program = new Command().argument("<files...>");

  program.parse(["a.js", "b.js", "c.js"], { from: "user" });

  assert.deepEqual(program.args, [["a.js", "b.js", "c.js"]]);
});

test("supports parseAsync with async action handlers", async () => {
  let result = "";
  const program = new Command()
    .argument("<input>")
    .option("--prefix <value>", "prefix", "say:")
    .action(async (input, options) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      result = `${options.prefix}${input}`;
    });

  const returned = await program.parseAsync(["--prefix", "echo:", "hello"], { from: "user" });

  assert.equal(returned, program);
  assert.equal(result, "echo:hello");
});

test("supports custom option processing with default accumulation", () => {
  const program = new Command().option(
    "-n, --number <value>",
    "collect a running total",
    (value, previous = 0) => previous + Number(value),
    0
  );

  program.parse(["-n", "2", "--number=3"], { from: "user" });

  assert.deepEqual(program.opts(), { number: 5 });
});

test("preserves parent option values when dispatching to subcommands", () => {
  let subcommandOptions = null;
  const program = new Command().option("-v, --verbose", "verbose output");

  program
    .command("run")
    .option("--dry-run", "skip writes")
    .action((options) => {
      subcommandOptions = options;
    });

  program.parse(["--verbose", "run", "--dry-run"], { from: "user" });

  assert.deepEqual(program.opts(), { verbose: true });
  assert.deepEqual(subcommandOptions, { dryRun: true });
});

test("throws for unknown options", () => {
  const program = new Command().option("--first");

  assert.throws(() => {
    program.parse(["--missing"], { from: "user" });
  }, /Unknown option: --missing/);
});

test("suggests similar options for unknown options", () => {
  const program = new Command().option("--first");

  assert.throws(() => {
    program.parse(["--firts"], { from: "user" });
  }, /Did you mean --first\?/);
});

test("suggests similar subcommands for unknown commands", () => {
  const program = new Command().name("demo");
  program.command("split");

  assert.throws(() => {
    program.parse(["splti"], { from: "user" });
  }, /Unknown command: splti \(Did you mean split\?\)/);
});

test("throws for missing required option", () => {
  const program = new Command().requiredOption("-t, --token <value>");

  assert.throws(() => {
    program.parse([], { from: "user" });
  }, /Missing required option/);
});

test("throws for missing required argument", () => {
  const program = new Command().argument("<input>");

  assert.throws(() => {
    program.parse([], { from: "user" });
  }, /Missing required argument/);
});

test("renders help information", () => {
  const program = new Command()
    .name("demo")
    .description("Demo CLI")
    .option("-s, --separator <char>", "separator", ",")
    .argument("<input>", "input string");

  const help = program.helpInformation();

  assert.match(help, /Usage: demo \[options] <input>/);
  assert.match(help, /Demo CLI/);
  assert.match(help, /Options:/);
});

test("renders aliases in command help", () => {
  const program = new Command().name("demo");
  program.command("split <input>").alias("sp").description("split text");

  const help = program.helpInformation();

  assert.match(help, /split\|sp <input>/);
});
