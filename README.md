# mini-commander-rewrite

A competition-oriented rewrite of [commander.js](https://github.com/tj/commander.js) focused on the core CLI experience first.

## Why this project

- The upstream repository is mature, popular, and comfortably exceeds the competition threshold on repository activity.
- The core feature set is concentrated around a few modules, which makes it practical to deliver a meaningful rewrite before the midterm checkpoint.
- A staged rewrite makes progress easy to demonstrate: parser core, help system, tests, examples, and documentation.

## Midterm scope

The current rewrite covers the main flow needed for common command-line tools:

- command registration
- positional arguments
- boolean and value options
- required options
- subcommands
- automatic help text
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
  string-util.js
tests/
  command.test.js
```

## Quick start

```bash
npm test
node examples/string-util.js split --separator=/ a/b/c
```

## Rewrite mapping

This rewrite currently targets the following upstream capabilities:

- `Command` object lifecycle
- `.command()`
- `.argument()`
- `.option()` / `.requiredOption()`
- `.action()`
- `.parse()`
- generated help output

Planned next steps:

- optional option values
- command aliases
- custom value processors
- async actions
- richer error formatting
