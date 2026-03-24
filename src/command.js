import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

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
    this._isDefault = false;
    this._executableDir = null;
    this._executableFile = null;
    this._isExternal = false;
    this._scriptPath = null;
  }

  name(value) {
    this._name = value;
    return this;
  }

  description(value) {
    this._description = value;
    if (this._isExternal && !this._summary) {
      this._summary = value;
    }
    return this;
  }

  summary(value) {
    this._summary = value;
    return this;
  }

  executableDir(directory) {
    this._executableDir = directory;
    return this;
  }

  executableFile(file) {
    this._executableFile = file;
    this._isExternal = true;
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
    this._helpDescription = flags === false ? this._helpDescription : description;
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

  addOption(option) {
    this._options.push(option);
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

  command(spec, descriptionOrConfig = {}, maybeConfig = {}) {
    const [name, ...argSpecs] = spec.trim().split(/\s+/);
    const command = new Command(name);
    command._parent = this;
    for (const argSpec of argSpecs) {
      command.argument(argSpec);
    }
    const isExternal = typeof descriptionOrConfig === "string";
    if (isExternal) {
      command._summary = descriptionOrConfig;
      command._isExternal = true;
    }

    const config = isExternal ? maybeConfig : descriptionOrConfig;
    this._applyCommandConfig(command, config);
    this._commands.push(command);
    return isExternal ? this : command;
  }

  addCommand(command, config = {}) {
    if (!(command instanceof Command)) {
      throw new Error("addCommand() expects a Command instance.");
    }
    command._parent = this;
    this._applyCommandConfig(command, config);
    this._commands.push(command);
    return this;
  }

  addArgument(argument) {
    this._arguments.push(argument);
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

  optsWithGlobals() {
    const chain = [];
    let command = this;

    while (command) {
      chain.unshift(command);
      command = command._parent;
    }

    return Object.assign({}, ...chain.map((item) => item.opts()));
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
      this._scriptPath = this._resolveScriptPath(argv, config.from);
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
      this._scriptPath = this._resolveScriptPath(argv, config.from);
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
        option.choicesDescription() +
        (option.defaultValue !== undefined ? ` (default: ${JSON.stringify(option.defaultValue)})` : "") +
        (option.required ? " (required)" : "")
    }));
    const effectiveHelpFlags = this._effectiveHelpFlags();
    if (effectiveHelpFlags) {
      rows.push({
        term: effectiveHelpFlags,
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
      if (index === 0 && this._shouldDispatchToDefaultCommand(tokens)) {
        const defaultCommand = this._defaultCommand();
        defaultCommand.parse(tokens, { from: "user" });
        this.args = defaultCommand.args;
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        this._dispatchSubcommandSync(subcommand, tokens.slice(index + 1));
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

    if (this._tryDefaultCommandSync(positional)) {
      return;
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
      if (index === 0 && this._shouldDispatchToDefaultCommand(tokens)) {
        const defaultCommand = this._defaultCommand();
        await defaultCommand.parseAsync(tokens, { from: "user" });
        this.args = defaultCommand.args;
        return;
      }
      const subcommand = this._commands.find((command) =>
        command._name === token || command._aliases.includes(token)
      );
      if (subcommand) {
        await this._dispatchSubcommandAsync(subcommand, tokens.slice(index + 1));
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

    if (await this._tryDefaultCommandAsync(positional)) {
      return;
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
    const resolvedOption = this._findOption(flagToken);
    if (!resolvedOption) {
      throw new Error(this._unknownOptionMessage(token));
    }
    const { command, option } = resolvedOption;

    if (option.negate) {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${flagToken} does not take a value.`);
      }
      command._setOptionValue(option, false);
      command._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (option.boolean) {
      if (inlineValue !== undefined) {
        throw new Error(`Option ${flagToken} does not take a value.`);
      }
      command._setOptionValue(option, true);
      command._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (inlineValue !== undefined) {
      command._setOptionValue(option, inlineValue);
      command._runOptionHandler(option.name);
      return startIndex + 1;
    }

    if (option.variadic) {
      return this._consumeVariadicOption(command, option, tokens, startIndex, flagToken);
    }

    const next = tokens[startIndex + 1];
    if (next === undefined || isOptionToken(next)) {
      if (option.valueOptional) {
        command._setOptionValue(option, true);
        command._runOptionHandler(option.name);
        return startIndex + 1;
      }
      throw new Error(`Option ${token} expects a value.`);
    }

    command._setOptionValue(option, next);
    command._runOptionHandler(option.name);
    return startIndex + 2;
  }

  _consumeCombinedShortOptions(tokens, startIndex) {
    const token = tokens[startIndex];
    const shortFlags = token.slice(1).split("");

    for (let index = 0; index < shortFlags.length; index += 1) {
      const shortFlag = shortFlags[index];
      const resolvedOption = this._findShortOption(shortFlag);
      if (!resolvedOption) {
        throw new Error(this._unknownOptionMessage(`-${shortFlag}`));
      }
      const { command, option } = resolvedOption;

      if (option.boolean) {
        command._setOptionValue(option, true);
        command._runOptionHandler(option.name);
        continue;
      }

      const rest = shortFlags.slice(index + 1).join("");
      if (rest) {
        command._setOptionValue(option, rest);
        command._runOptionHandler(option.name);
        return startIndex + 1;
      }

      if (option.variadic) {
        return this._consumeVariadicOption(command, option, tokens, startIndex, option.short);
      }

      const next = tokens[startIndex + 1];
      if (next === undefined || isOptionToken(next)) {
        if (option.valueOptional) {
          command._setOptionValue(option, true);
          command._runOptionHandler(option.name);
          return startIndex + 1;
        }
        throw new Error(`Option ${option.short} expects a value.`);
      }

      command._setOptionValue(option, next);
      command._runOptionHandler(option.name);
      return startIndex + 2;
    }

    return startIndex + 1;
  }

  _runOptionHandler(optionName) {
    const handler = this._optionHandlers?.get(optionName);
    if (handler) handler();
  }

  _applyCommandConfig(command, config) {
    if (config?.isDefault) {
      command._isDefault = true;
    }
    if (config?.executableFile) {
      command.executableFile(config.executableFile);
    }
  }

  _defaultCommand() {
    return this._commands.find((command) => command._isDefault);
  }

  _canUseDefaultCommand(positional) {
    return Boolean(
      this._defaultCommand() &&
      this._arguments.length === 0 &&
      this._action === null &&
      (positional.length > 0 || this._commands.length > 0)
    );
  }

  _shouldDispatchToDefaultCommand(tokens) {
    const defaultCommand = this._defaultCommand();
    if (!defaultCommand || this._arguments.length > 0 || this._action !== null || this._options.length > 0) {
      return false;
    }

    const firstNonOption = tokens.find((token) => token !== "--" && !isOptionToken(token));
    if (!firstNonOption) {
      return true;
    }

    return !this._commands.some(
      (command) =>
        command !== defaultCommand &&
        (command._name === firstNonOption || command._aliases.includes(firstNonOption))
    );
  }

  _tryDefaultCommandSync(positional) {
    if (!this._canUseDefaultCommand(positional)) {
      return false;
    }

    const defaultCommand = this._defaultCommand();
    this._dispatchSubcommandSync(defaultCommand, positional);
    this.args = defaultCommand.args;
    return true;
  }

  async _tryDefaultCommandAsync(positional) {
    if (!this._canUseDefaultCommand(positional)) {
      return false;
    }

    const defaultCommand = this._defaultCommand();
    await this._dispatchSubcommandAsync(defaultCommand, positional);
    this.args = defaultCommand.args;
    return true;
  }

  _dispatchSubcommandSync(subcommand, tokens) {
    if (subcommand._isExternal) {
      this._executeExternalSubcommandSync(subcommand, tokens);
      return;
    }

    subcommand.parse(tokens, { from: "user" });
  }

  async _dispatchSubcommandAsync(subcommand, tokens) {
    if (subcommand._isExternal) {
      await this._executeExternalSubcommandAsync(subcommand, tokens);
      return;
    }

    await subcommand.parseAsync(tokens, { from: "user" });
  }

  _consumeVariadicOption(ownerCommand, option, tokens, startIndex, flagToken) {
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
        ownerCommand._setOptionValue(option, true);
        ownerCommand._runOptionHandler(option.name);
        return startIndex + 1;
      }
      throw new Error(`Option ${flagToken} expects a value.`);
    }

    for (const value of collectedValues) {
      ownerCommand._setOptionValue(option, value);
    }
    ownerCommand._runOptionHandler(option.name);
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

  _resolveScriptPath(argv, from = "node") {
    if (from === "node" && Array.isArray(argv) && argv.length >= 2) {
      return argv[1];
    }
    if (from === "node" && process.argv.length >= 2) {
      return process.argv[1];
    }
    return this._scriptPath;
  }

  _setOptionValue(option, rawValue) {
    const previousValue = this._optionValues[option.name];
    this._optionValues[option.name] = option.parseValue(rawValue, previousValue);
  }

  _findOption(flagToken) {
    let command = this;
    while (command) {
      const option = command._options.find((item) => item.matches(flagToken));
      if (option) {
        return { command, option };
      }
      command = command._parent;
    }
    return null;
  }

  _findShortOption(shortFlag) {
    let command = this;
    while (command) {
      const option = command._options.find((item) => item.isShortFlag(shortFlag));
      if (option) {
        return { command, option };
      }
      command = command._parent;
    }
    return null;
  }

  _resolveExecutableDir() {
    if (this._executableDir) {
      return path.resolve(this._executableDir);
    }

    if (this._parent) {
      return this._parent._resolveExecutableDir();
    }

    if (this._scriptPath) {
      return path.dirname(path.resolve(this._scriptPath));
    }

    return process.cwd();
  }

  _resolveProgramBasename() {
    if (this._parent) {
      return this._parent._resolveProgramBasename();
    }

    if (this._name) {
      return this._name;
    }

    if (this._scriptPath) {
      return path.basename(this._scriptPath, path.extname(this._scriptPath));
    }

    return "program";
  }

  _resolveExecutablePath(subcommand) {
    const executableDir = subcommand._resolveExecutableDir();
    if (subcommand._executableFile) {
      return path.isAbsolute(subcommand._executableFile)
        ? subcommand._executableFile
        : path.resolve(executableDir, subcommand._executableFile);
    }

    const baseName = `${subcommand._resolveProgramBasename()}-${subcommand._name}`;
    const candidates = [
      path.resolve(executableDir, baseName),
      path.resolve(executableDir, `${baseName}.js`),
      path.resolve(executableDir, `${baseName}.mjs`),
      path.resolve(executableDir, `${baseName}.cjs`)
    ];

    const matchedPath = candidates.find((candidate) => existsSync(candidate));
    if (!matchedPath) {
      throw new Error(
        `Cannot find executable for subcommand ${subcommand._name}. Expected one of ${candidates.join(", ")}.`
      );
    }

    return matchedPath;
  }

  _buildExternalInvocation(subcommand, tokens) {
    const executablePath = this._resolveExecutablePath(subcommand);
    const extension = path.extname(executablePath).toLowerCase();

    if ([".js", ".mjs", ".cjs"].includes(extension)) {
      return {
        command: process.execPath,
        args: [executablePath, ...tokens]
      };
    }

    return {
      command: executablePath,
      args: tokens
    };
  }

  _executeExternalSubcommandSync(subcommand, tokens) {
    const invocation = this._buildExternalInvocation(subcommand, tokens);
    const result = spawnSync(invocation.command, invocation.args, {
      cwd: process.cwd(),
      env: process.env,
      encoding: "utf8",
      stdio: "pipe"
    });

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`External command failed: ${subcommand._name} exited with code ${result.status}`);
    }
  }

  _executeExternalSubcommandAsync(subcommand, tokens) {
    const invocation = this._buildExternalInvocation(subcommand, tokens);

    return new Promise((resolve, reject) => {
      const child = spawn(invocation.command, invocation.args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["inherit", "pipe", "pipe"]
      });

      child.stdout.on("data", (chunk) => {
        process.stdout.write(chunk);
      });
      child.stderr.on("data", (chunk) => {
        process.stderr.write(chunk);
      });

      child.on("error", reject);
      child.on("close", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`External command failed: ${subcommand._name} exited with code ${code}`));
      });
    });
  }

  _isHelpToken(token) {
    const effectiveHelpFlags = this._effectiveHelpFlags();
    if (!effectiveHelpFlags) {
      return false;
    }
    const helpOption = new OptionDefinition(effectiveHelpFlags, this._helpDescription);
    return helpOption.matches(token);
  }

  _effectiveHelpFlags() {
    if (!this._helpFlags) {
      return null;
    }

    const helpOption = new OptionDefinition(this._helpFlags, this._helpDescription);
    const conflictingFlags = new Set(
      this._options.flatMap((option) => [option.short, option.long]).filter(Boolean)
    );

    const effectiveFlags = [helpOption.short, helpOption.long].filter(
      (flag) => flag && !conflictingFlags.has(flag)
    );

    if (effectiveFlags.length === 0) {
      return null;
    }

    return effectiveFlags.join(", ");
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
    const candidates = [];
    let command = this;

    while (command) {
      candidates.push(...command._options.flatMap((option) => [option.short, option.long].filter(Boolean)));
      command = command._parent;
    }

    const suggestion = suggestClosest(token, candidates);
    return suggestion
      ? `Unknown option: ${token} (Did you mean ${suggestion}?)`
      : `Unknown option: ${token}`;
  }

  _throwForUnknownCommand(token, positionalCount) {
    if (
      positionalCount > 0 ||
      this._arguments.length > 0 ||
      this._commands.length === 0 ||
      (this._defaultCommand() && this._action === null && this._arguments.length === 0)
    ) {
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
