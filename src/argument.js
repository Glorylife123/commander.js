function validateChoices(value, choices, label) {
  if (!choices) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];
  const invalidValue = values.find((item) => item !== undefined && !choices.includes(item));

  if (invalidValue !== undefined) {
    throw new Error(
      `Invalid value for argument ${label}. Allowed choices are ${choices.map((item) => JSON.stringify(item)).join(", ")}.`
    );
  }
}

export class ArgumentDefinition {
  constructor(spec, description = "", config = {}) {
    this.spec = spec.trim();
    this.description = description;
    this.defaultValue = config.defaultValue;
    this.parser = config.parser ?? null;
    this.choicesValues = config.choicesValues ?? null;
    this.required = this.spec.startsWith("<");
    this.variadic = this.spec.includes("...");
    this.name = this.spec
      .replace(/^\[|^</, "")
      .replace(/]$|>$/, "")
      .replace(/\.\.\.$/, "");
  }

  parseValue(value, previousValue) {
    let processedValue;

    if (!this.parser) {
      processedValue = value;
    } else {
      try {
        processedValue = this.parser(value, previousValue);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid value for argument ${this.name}: ${detail}`);
      }
    }

    validateChoices(processedValue, this.choicesValues, this.name);
    return processedValue;
  }

  choices(values) {
    this.choicesValues = [...values];
    return this;
  }

  choicesDescription() {
    if (!this.choicesValues?.length) {
      return "";
    }
    return ` (choices: ${this.choicesValues.map((item) => JSON.stringify(item)).join(", ")})`;
  }
}

export class Argument extends ArgumentDefinition {}
