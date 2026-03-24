import { ArgumentDefinition } from "./argument.js";
import { HelpRenderer } from "./help.js";
import { OptionDefinition } from "./option.js";
import { suggestClosest } from "./utils.js";

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

function cloneDefaultValue(definition) {
  if (definition.defaultValue === undefined) return undefined;
  if (Array.isArray(definition.defaultValue)) return [...definition.defaultValue];
  if (definition.defaultValue && typeof definition.defaultValue === "object") {
    return { ...definition.defaultValue };
  }
  return definition.defaultValue;
}

function isOptionToken(value) {
  if (typeof value !== "string" || value === "-") {
    return false;
  }
  if (/^-\d+(\.\d+)?$/.test(value)) {
    return false;
  }
  return value.startsWith("-");
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
    this.processedArgs = [];
    this._optionValues = {};
    this._helpFlags = "-h, --help";
    this._helpDescription = "display help for command";
    this._showHelpAfterError = false;
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

  argument(spec, description = "", defaultValue) {
    const { parser, resolvedDefaultValue } = this._normalizeValueConfig(defaultValue, arguments[3]);
    this._arguments.push(
      new ArgumentDefinition(spec, description, {
        defaultValue: resolvedDefaultValue,
        parser
      })
    );
    return this;
  }

  helpOption(flags, description = "display help for command") {
    this._helpFlags = flags;
    this._helpDescription = description;
    return this;
  }

  showHelpAfterError(displayHelp = true) {
    this._showHelpAfterError = displayHelp;
    return this;
  }

  option(flags, description = "", defaultValue) {
    const { parser, resolvedDefaultValue } = this._normalizeValueConfig(defaultValue, arguments[3]);
    this._options.push(
      new OptionDefinition(flags, description, { defaultValue: resolvedDefaultValue, parser })
    );
    return this;
  }

  requiredOption(flags, description = "", defaultValue) {
    const { parser, resolvedDefaultValue } = this._normalizeValueConfig(defaultValue, arguments[3]);
    this._options.push(
      new OptionDefinition(flags, description, {
        required: true,
        defaultValue: resolvedDefaultValue,
        parser
      })
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

  addCommand(command) {
    if (!(command instanceof Command)) {
      throw new Error("addCommand() expects a Command instance.");
    }
    command._parent = this;
    this._commands.push(command);
    return this;
  }

  arguments(specs) {
    const argSpecs = specs.trim().split(/\s+/).filter(Boolean);
    for (const argSpec of argSpecs) {
      this.argument(argSpec);
    }
    return this;
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
    try {
      this._resetState();
      const userArgs = normalizeArgv(argv, config.from);
      this.rawArgs = [...userArgs];
      this._parseTokensSync(userArgs);
    } catch (error) {
      throw this._formatRuntimeError(error);
    }
    return this;
  }

  async parseAsync(argv, config = {}) {
    try {
      this._resetState();
      const userArgs = normalizeArgv(argv, config.from);
      this.rawArgs = [...userArgs];
      await this._parseTokensAsync(userArgs);
    } catch (error) {
      throw this._formatRuntimeError(error);
    }
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
    if (this._helpFlags) {
      rows.push({
        term: this._helpFlags,
        description: this._helpDescription
      });
    }
    return rows;
  }

  _resetState() {
    this.args = [];
    this.processedArgs = [];
    this.rawArgs = [];
    this._optionValues = {};
    for (const option of this._options) {
      const value = cloneDefaultValue(option);
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
      if (this._isHelpToken(token)) {
        this.outputHelp();
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        subcommand.parse(tokens.slice(index + 1), { from: "user" });
        this.args = subcommand.args;
        return;
      }
      if (token.startsWith("-")) {
        index = this._consumeOption(tokens, index);
      } else {
        this._throwForUnknownCommand(token, positional.length);
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
      if (this._isHelpToken(token)) {
        this.outputHelp();
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        await subcommand.parseAsync(tokens.slice(index + 1), { from: "user" });
        this.args = subcommand.args;
        return;
      }
      if (token.startsWith("-")) {
        index = this._consumeOption(tokens, index);
      } else {
        this._throwForUnknownCommand(token, positional.length);
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
      throw new Error(this._unknownOptionMessage(token));
    }

    if (option.negate) {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${flagToken} does not take a value.`);
      }
      this._setOptionValue(option, false);
      this._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (option.boolean) {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${flagToken} does not take a value.`);
      }
      this._setOptionValue(option, true);
      this._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (inlineValue !== undefined) {
      this._setOptionValue(option, inlineValue);
      this._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (option.variadic) {
      return this._consumeVariadicOption(option, tokens, startIndex, flagToken);
    }

    const next = tokens[startIndex + 1];
    if (next === undefined || isOptionToken(next)) {
      if (option.valueOptional) {
        this._setOptionValue(option, true);
        this._runOptionHandler(option.name);
        return startIndex + 1;
      }
      throw new Error(`Option ${token} expects a value.`);
    }

    this._setOptionValue(option, next);
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
        throw new Error(this._unknownOptionMessage(`-${shortFlag}`));
      }

      if (option.boolean) {
        this._setOptionValue(option, true);
        this._runOptionHandler(option.name);
        continue;
      }

      const rest = shortFlags.slice(index + 1).join("");
      if (rest) {
        this._setOptionValue(option, rest);
        this._runOptionHandler(option.name);
        return startIndex + 1;
      }

      if (option.variadic) {
        return this._consumeVariadicOption(option, tokens, startIndex, option.short);
      }

      const next = tokens[startIndex + 1];
      if (next === undefined || isOptionToken(next)) {
        if (option.valueOptional) {
          this._setOptionValue(option, true);
          this._runOptionHandler(option.name);
          return startIndex + 1;
        }
        throw new Error(`Option ${option.short} expects a value.`);
      }

      this._setOptionValue(option, next);
      this._runOptionHandler(option.name);
      return startIndex + 2;
    }

    return startIndex + 1;
  }

  _runOptionHandler(optionName) {
    const handler = this._optionHandlers?.get(optionName);
    if (handler) handler();
  }

  _consumeVariadicOption(option, tokens, startIndex, flagToken) {
    const collectedValues = [];
    let index = startIndex + 1;

    while (index < tokens.length) {
      const token = tokens[index];
      if (token === "--" || isOptionToken(token)) {
        break;
      }
      collectedValues.push(token);
      index += 1;
    }

    if (collectedValues.length === 0) {
      if (option.valueOptional) {
        this._setOptionValue(option, true);
        this._runOptionHandler(option.name);
        return startIndex + 1;
      }
      throw new Error(`Option ${flagToken} expects a value.`);
    }

    for (const value of collectedValues) {
      this._setOptionValue(option, value);
    }
    this._runOptionHandler(option.name);
    return index;
  }

  _normalizeValueConfig(parserOrDefaultValue, explicitDefaultValue) {
    if (typeof parserOrDefaultValue === "function") {
      return {
        parser: parserOrDefaultValue,
        resolvedDefaultValue: explicitDefaultValue
      };
    }

    return {
      parser: null,
      resolvedDefaultValue: parserOrDefaultValue
    };
  }

  _setOptionValue(option, rawValue) {
    const previousValue = this._optionValues[option.name];
    this._optionValues[option.name] = option.parseValue(rawValue, previousValue);
  }

  _isHelpToken(token) {
    if (!this._helpFlags) {
      return false;
    }
    const helpOption = new OptionDefinition(this._helpFlags, this._helpDescription);
    return helpOption.matches(token);
  }

  _formatRuntimeError(error) {
    if (error?._formattedByCommand) {
      return error;
    }

    const originalMessage = error instanceof Error ? error.message : String(error);
    const formattedMessage = [`error: ${originalMessage}`];

    if (this._showHelpAfterError) {
      if (typeof this._showHelpAfterError === "string") {
        formattedMessage.push(this._showHelpAfterError);
      }
      formattedMessage.push(this.helpInformation());
    }

    const formattedError = new Error(formattedMessage.join("\n\n"));
    formattedError._formattedByCommand = true;
    return formattedError;
  }

  _unknownOptionMessage(token) {
    const candidates = this._options.flatMap((option) => [option.short, option.long].filter(Boolean));
    const suggestion = suggestClosest(token, candidates);
    return suggestion
      ? `Unknown option: ${token} (Did you mean ${suggestion}?)`
      : `Unknown option: ${token}`;
  }

  _throwForUnknownCommand(token, positionalCount) {
    if (positionalCount > 0 || this._arguments.length > 0 || this._commands.length === 0) {
      return;
    }

    const candidates = this._commands.flatMap((command) => [command._name, ...command._aliases]);
    const suggestion = suggestClosest(token, candidates);
    const suffix = suggestion ? ` (Did you mean ${suggestion}?)` : "";
    throw new Error(`Unknown command: ${token}${suffix}`);
  }

  _applyArguments(values) {
    this.args = [];
    this.processedArgs = [];
    let index = 0;

    for (const definition of this._arguments) {
      if (definition.variadic) {
        const rest = values.slice(index);
        if (definition.required && rest.length === 0) {
          throw new Error(`Missing required argument: ${definition.name}`);
        }

        if (definition.parser) {
          let processedValue = cloneDefaultValue(definition);
          for (const item of rest) {
            processedValue = definition.parseValue(item, processedValue);
          }
          if (processedValue === undefined) {
            processedValue = [];
          }
          this.args.push(processedValue);
        } else {
          this.args.push(rest);
        }

        index = values.length;
        continue;
      }

      const value = values[index];
      if (value === undefined) {
        if (definition.required) {
          throw new Error(`Missing required argument: ${definition.name}`);
        }
        this.args.push(cloneDefaultValue(definition));
      } else {
        const previousValue = cloneDefaultValue(definition);
        this.args.push(definition.parseValue(value, previousValue));
        index += 1;
      }
    }

    if (index < values.length) {
      throw new Error(`Too many arguments: ${values.slice(index).join(" ")}`);
    }

    this.processedArgs = [...this.args];
  }

  _validateRequiredOptions() {
    for (const option of this._options) {
      if (option.required && this._optionValues[option.name] === undefined) {
        throw new Error(`Missing required option: ${option.long ?? option.short}`);
      }
      if (
        option.negate &&
        this._optionValues[option.name] === undefined &&
        !this._options.some((item) => item.name === option.name && item !== option && !item.negate)
      ) {
        this._optionValues[option.name] = true;
      }
    }
  }
}
