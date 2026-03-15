import { ArgumentDefinition } from "./argument.js";
import { HelpRenderer } from "./help.js";
import { OptionDefinition } from "./option.js";

function normalizeArgv(argv, from = "node") {
  if (!argv) {
    return process.argv.slice(2);
  }
  if (!Array.isArray(argv)) {
    throw new Error("parse() expects an array of arguments.");
  }
  if (from === "user") return [...argv];
  if (from === "node") return argv.slice(2);
  throw new Error(`Unsupported parse source: ${from}`);
}

function cloneDefault(option) {
  if (option.defaultValue === undefined) return undefined;
  if (Array.isArray(option.defaultValue)) return [...option.defaultValue];
  if (option.defaultValue && typeof option.defaultValue === "object") {
    return { ...option.defaultValue };
  }
  return option.defaultValue;
}

function isOptionToken(value) {
  return typeof value === "string" && value.startsWith("-") && value !== "-";
}

export class Command {
  constructor(name = "") {
    this._name = name;
    this._description = "";
    this._summary = "";
    this._version = "";
    this._arguments = [];
    this._options = [];
    this._commands = [];
    this._action = null;
    this._aliases = [];
    this._parent = null;
    this.args = [];
    this.rawArgs = [];
    this._optionValues = {};
  }

  name(value) {
    this._name = value;
    return this;
  }

  description(value) {
    this._description = value;
    return this;
  }

  summary(value) {
    this._summary = value;
    return this;
  }

  alias(value) {
    if (!this._aliases.includes(value)) {
      this._aliases.push(value);
    }
    return this;
  }

  version(value) {
    this._version = value;
    return this.option("-V, --version", "display the version number").actionOnOption("version", () => {
      console.log(value);
    });
  }

  argument(spec, description = "") {
    this._arguments.push(new ArgumentDefinition(spec, description));
    return this;
  }

  option(flags, description = "", defaultValue) {
    this._options.push(new OptionDefinition(flags, description, { defaultValue }));
    return this;
  }

  requiredOption(flags, description = "", defaultValue) {
    this._options.push(
      new OptionDefinition(flags, description, { required: true, defaultValue })
    );
    return this;
  }

  command(spec) {
    const [name, ...argSpecs] = spec.trim().split(/\s+/);
    const command = new Command(name);
    command._parent = this;
    for (const argSpec of argSpecs) {
      command.argument(argSpec);
    }
    this._commands.push(command);
    return command;
  }

  action(handler) {
    this._action = handler;
    return this;
  }

  actionOnOption(optionName, handler) {
    if (!this._optionHandlers) this._optionHandlers = new Map();
    this._optionHandlers.set(optionName, handler);
    return this;
  }

  opts() {
    return { ...this._optionValues };
  }

  helpInformation() {
    return new HelpRenderer(this).render();
  }

  outputHelp() {
    console.log(this.helpInformation());
    return this;
  }

  parse(argv, config = {}) {
    this._resetState();
    const userArgs = normalizeArgv(argv, config.from);
    this.rawArgs = [...userArgs];
    this._parseTokensSync(userArgs);
    return this;
  }

  async parseAsync(argv, config = {}) {
    this._resetState();
    const userArgs = normalizeArgv(argv, config.from);
    this.rawArgs = [...userArgs];
    await this._parseTokensAsync(userArgs);
    return this;
  }

  _displayName() {
    if (!this._parent) {
      return this._name || "program";
    }
    return `${this._parent._displayName()} ${this._name}`;
  }

  _commandSignature() {
    const argumentsPart = this._arguments.map((argument) => argument.spec).join(" ");
    const aliasPart = this._aliases.length ? `|${this._aliases.join("|")}` : "";
    return [`${this._name}${aliasPart}`, argumentsPart].filter(Boolean).join(" ");
  }

  _helpOptions() {
    const rows = this._options.map((option) => ({
      term: option.flags,
      description:
        option.description +
        (option.defaultValue !== undefined ? ` (default: ${JSON.stringify(option.defaultValue)})` : "") +
        (option.required ? " (required)" : "")
    }));
    rows.push({
      term: "-h, --help",
      description: "display help for command"
    });
    return rows;
  }

  _resetState() {
    this.args = [];
    this.rawArgs = [];
    this._optionValues = {};
    for (const option of this._options) {
      const value = cloneDefault(option);
      if (value !== undefined) {
        this._optionValues[option.name] = value;
      }
    }
  }

  _parseTokensSync(tokens) {
    let index = 0;
    const positional = [];

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "--") {
        positional.push(...tokens.slice(index + 1));
        break;
      }
      if (token === "-h" || token === "--help") {
        this.outputHelp();
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        subcommand.parse(tokens.slice(index + 1), { from: "user" });
        this.args = subcommand.args;
        this._optionValues = { ...subcommand.opts() };
        return;
      }
      if (token.startsWith("-")) {
        index = this._consumeOption(tokens, index);
      } else {
        positional.push(token);
        index += 1;
      }
    }

    this._applyArguments(positional);
    this._validateRequiredOptions();
    if (this._action) {
      this._action(...this.args, this.opts(), this);
    }
  }

  async _parseTokensAsync(tokens) {
    let index = 0;
    const positional = [];

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "--") {
        positional.push(...tokens.slice(index + 1));
        break;
      }
      if (token === "-h" || token === "--help") {
        this.outputHelp();
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        await subcommand.parseAsync(tokens.slice(index + 1), { from: "user" });
        this.args = subcommand.args;
        this._optionValues = { ...subcommand.opts() };
        return;
      }
      if (token.startsWith("-")) {
        index = this._consumeOption(tokens, index);
      } else {
        positional.push(token);
        index += 1;
      }
    }

    this._applyArguments(positional);
    this._validateRequiredOptions();
    if (this._action) {
      await this._action(...this.args, this.opts(), this);
    }
  }

  _consumeOption(tokens, startIndex) {
    const token = tokens[startIndex];
    if (/^-[^-]{2,}/.test(token) && !token.includes("=")) {
      return this._consumeCombinedShortOptions(tokens, startIndex);
    }
    const [flagToken, inlineValue] = token.split(/=(.*)/s, 2);
    const option = this._options.find((item) => item.matches(flagToken));
    if (!option) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (option.boolean) {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${flagToken} does not take a value.`);
      }
      this._optionValues[option.name] = true;
      this._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (inlineValue !== undefined) {
      this._optionValues[option.name] = inlineValue;
      this._runOptionHandler(option.name);
      return startIndex + 1;
    }

    const next = tokens[startIndex + 1];
    if (next === undefined || isOptionToken(next)) {
      if (option.valueOptional) {
        this._optionValues[option.name] = true;
        this._runOptionHandler(option.name);
        return startIndex + 1;
      }
      throw new Error(`Option ${token} expects a value.`);
    }

    this._optionValues[option.name] = next;
    this._runOptionHandler(option.name);
    return startIndex + 2;
  }

  _consumeCombinedShortOptions(tokens, startIndex) {
    const token = tokens[startIndex];
    const shortFlags = token.slice(1).split("");

    for (let index = 0; index < shortFlags.length; index += 1) {
      const shortFlag = shortFlags[index];
      const option = this._options.find((item) => item.isShortFlag(shortFlag));
      if (!option) {
        throw new Error(`Unknown option: -${shortFlag}`);
      }

      if (option.boolean) {
        this._optionValues[option.name] = true;
        this._runOptionHandler(option.name);
        continue;
      }

      const rest = shortFlags.slice(index + 1).join("");
      if (rest) {
        this._optionValues[option.name] = rest;
        this._runOptionHandler(option.name);
        return startIndex + 1;
      }

      const next = tokens[startIndex + 1];
      if (next === undefined || isOptionToken(next)) {
        if (option.valueOptional) {
          this._optionValues[option.name] = true;
          this._runOptionHandler(option.name);
          return startIndex + 1;
        }
        throw new Error(`Option ${option.short} expects a value.`);
      }

      this._optionValues[option.name] = next;
      this._runOptionHandler(option.name);
      return startIndex + 2;
    }

    return startIndex + 1;
  }

  _runOptionHandler(optionName) {
    const handler = this._optionHandlers?.get(optionName);
    if (handler) handler();
  }

  _applyArguments(values) {
    this.args = [];
    let index = 0;

    for (const definition of this._arguments) {
      if (definition.variadic) {
        const rest = values.slice(index);
        if (definition.required && rest.length === 0) {
          throw new Error(`Missing required argument: ${definition.name}`);
        }
        this.args.push(rest);
        index = values.length;
        continue;
      }

      const value = values[index];
      if (value === undefined) {
        if (definition.required) {
          throw new Error(`Missing required argument: ${definition.name}`);
        }
        this.args.push(undefined);
      } else {
        this.args.push(value);
        index += 1;
      }
    }

    if (index < values.length) {
      throw new Error(`Too many arguments: ${values.slice(index).join(" ")}`);
    }
  }

  _validateRequiredOptions() {
    for (const option of this._options) {
      if (option.required && this._optionValues[option.name] === undefined) {
        throw new Error(`Missing required option: ${option.long ?? option.short}`);
      }
    }
  }
}
