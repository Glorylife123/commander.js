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

test("supports long option inline values", () => {
  const program = new Command()
    .option("-s, --separator <char>", "separator", ",")
    .argument("<input>");

  program.parse(["--separator=/", "a/b/c"], { from: "user" });

  assert.deepEqual(program.opts(), { separator: "/" });
  assert.deepEqual(program.args, ["a/b/c"]);
});

test("throws for unknown options", () => {
  const program = new Command().option("--first");

  assert.throws(() => {
    program.parse(["--missing"], { from: "user" });
  }, /Unknown option/);
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
