import { camelCase, stripAngleBrackets } from "./utils.js";

function splitFlags(flags) {
  return flags
    .split(/[ ,|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export class OptionDefinition {
  constructor(flags, description = "", config = {}) {
    this.flags = flags;
    this.description = description;
    this.required = Boolean(config.required);
    this.defaultValue = config.defaultValue;
    this.parser = config.parser ?? null;

    const parts = splitFlags(flags);
    this.short = parts.find((part) => part.startsWith("-") && !part.startsWith("--"));
    this.long = parts.find((part) => part.startsWith("--"));
    const source = this.long ?? this.short;
    const namePart = source
      .replace(/^-{1,2}/, "")
      .replace(/^no-/, "")
      .split(/[ <[]/)[0];
    this.name = camelCase(namePart);
    this.valueRequired = /<.+>/.test(flags);
    this.valueOptional = /\[.+\]/.test(flags);
    this.variadic = /\.\.\./.test(flags);
    this.negate = Boolean(this.long?.startsWith("--no-")) && !this.valueRequired && !this.valueOptional;
    this.boolean = !this.valueRequired && !this.valueOptional;
    this.placeholder = this.valueRequired || this.valueOptional
      ? stripAngleBrackets(flags.match(/(<.+?>|\[.+?])/)[0]).replace(/\.\.\.$/, "")
      : null;
  }

  matches(token) {
    return token === this.short || token === this.long;
  }

  isShortFlag(token) {
    return Boolean(this.short) && token === this.short.replace(/^-/, "");
  }

  parseValue(value, previousValue) {
    if (!this.parser) {
      if (this.variadic && value !== true) {
        const values = Array.isArray(previousValue) ? previousValue : [];
        return values.concat([value]);
      }
      return value;
    }

    try {
      return this.parser(value, previousValue);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid value for option ${this.long ?? this.short}: ${detail}`);
    }
  }
}
