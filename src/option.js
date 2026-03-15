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

    const parts = splitFlags(flags);
    this.short = parts.find((part) => part.startsWith("-") && !part.startsWith("--"));
    this.long = parts.find((part) => part.startsWith("--"));
    const source = this.long ?? this.short;
    const namePart = source.replace(/^-{1,2}/, "").split(/[ <[]/)[0];
    this.name = camelCase(namePart);
    this.valueRequired = /<.+>/.test(flags);
    this.valueOptional = /\[.+\]/.test(flags);
    this.boolean = !this.valueRequired && !this.valueOptional;
    this.placeholder = this.valueRequired || this.valueOptional
      ? stripAngleBrackets(flags.match(/(<.+?>|\[.+?])/)[0])
      : null;
  }

  matches(token) {
    return token === this.short || token === this.long;
  }

  isShortFlag(token) {
    return Boolean(this.short) && token === this.short.replace(/^-/, "");
  }
}
