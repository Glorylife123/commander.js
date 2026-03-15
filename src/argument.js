export class ArgumentDefinition {
  constructor(spec, description = "") {
    this.spec = spec.trim();
    this.description = description;
    this.required = this.spec.startsWith("<");
    this.variadic = this.spec.endsWith("...");
    this.name = this.spec
      .replace(/^\[|^</, "")
      .replace(/]$|>$/, "")
      .replace(/\.\.\.$/, "");
  }
}
