export class ArgumentDefinition {
  constructor(spec, description = "", config = {}) {
    this.spec = spec.trim();
    this.description = description;
    this.defaultValue = config.defaultValue;
    this.parser = config.parser ?? null;
    this.required = this.spec.startsWith("<");
    this.variadic = this.spec.includes("...");
    this.name = this.spec
      .replace(/^\[|^</, "")
      .replace(/]$|>$/, "")
      .replace(/\.\.\.$/, "");
  }

  parseValue(value, previousValue) {
    if (!this.parser) {
      return value;
    }

    try {
      return this.parser(value, previousValue);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`Invalid value for argument ${this.name}: ${detail}`);
    }
  }
}
