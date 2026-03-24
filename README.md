# mini-commander-rewrite

A competition-oriented rewrite of [commander.js](https://github.com/tj/commander.js) focused on the core CLI experience first.

## Why this project

- The upstream repository is mature, popular, and comfortably exceeds the competition threshold on repository activity.
- The core feature set is concentrated around a few modules, which makes it practical to deliver a meaningful rewrite before the midterm checkpoint.
- A staged rewrite makes progress easy to demonstrate: parser core, help system, tests, examples, and documentation.

## Current scope

The current rewrite covers the main flow needed for common command-line tools and final-demo scenarios:

- command registration
- positional arguments and `.arguments()`
- boolean and value options
- negatable boolean options like `--no-color`
- optional option values
- variadic options like `--tag <name...>`
- required options
- subcommands
- standalone executable subcommands
- `.addCommand()` with preconfigured subcommands
- command aliases
- custom option value processing
- custom argument value processing
- async action handlers via `parseAsync()`
- combined short flags like `-alh`
- automatic help text
- custom help flags via `.helpOption()`
- formatted errors and `.showHelpAfterError()`
- suggestion messages for unknown options and subcommands
- action handlers
- basic validation errors

## Project structure

```text
src/
  argument.js
  command.js
  help.js
  index.js
  option.js
  utils.js
examples/
  release.js
  service-async-check.js
  service-async.js
  service-start.js
  service.js
  string-util.js
tests/
  command.test.js
```

## Quick start

```bash
node --test
node examples/string-util.js split --separator=/ a/b/c
node examples/string-util.js split --list a b c
node examples/release.js ship app.tar.gz build-17 -t abc123 --tag stable beta --no-color
node examples/service.js start api --port 3000 --tag blue green
node examples/service-async.js check gateway --verbose
```

## Final defense entry

If you are preparing for the final presentation, start here:

- `FINAL_DEFENSE.md`: final capability summary, completion estimate, and suggested defense wording
- `DEMO_SCRIPT.md`: runnable demo order, commands, expected output, and speaking prompts

## Rewrite mapping

This rewrite currently targets the following upstream capabilities:

- `Command` object lifecycle
- `.command()`
- `.argument()`
- `.arguments()`
- `.addCommand()`
- standalone executable subcommands via `.command("name", "description")`
- `.executableDir()` / `.executableFile()`
- `.option()` / `.requiredOption()`
- `.alias()`
- custom option and argument processing
- `.action()`
- `.parse()` / `.parseAsync()`
- generated help output
- `.helpOption()`
- `.showHelpAfterError()`
- negatable and variadic options

Planned next steps:

- default subcommands
- richer compatibility behaviors around help and option inheritance

## Standalone executable subcommands

This rewrite supports dispatching a subcommand to an external executable script.

### Convention-based executable lookup

If you declare a subcommand with a string description, it is treated as an external subcommand:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "./src/index.js";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));

const program = new Command()
  .name("service")
  .executableDir(exampleDir);

program.command("start <name>", "start a service with an external script");
program.parse(process.argv);
```

The command above looks for one of these files inside `exampleDir`:

- `service-start`
- `service-start.js`
- `service-start.mjs`
- `service-start.cjs`

### Explicit executable file

You can also register a preconfigured command and point it to a specific file:

```js
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Command } from "./src/index.js";

const exampleDir = path.dirname(fileURLToPath(import.meta.url));

const status = new Command("status")
  .description("check service status through an external script")
  .executableFile(path.join(exampleDir, "service-async-check.js"));

const program = new Command().name("service-async").addCommand(status);
await program.parseAsync(process.argv);
```

### Runnable examples

```bash
node examples/service.js start api --port 3000 --tag blue green
node examples/service-async.js check gateway --verbose
```
