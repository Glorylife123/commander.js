import { pad } from "./utils.js";

function formatSection(title, rows) {
  if (!rows.length) return "";
  const width = rows.reduce((max, row) => Math.max(max, row.term.length), 0);
  const body = rows
    .map((row) => `  ${pad(row.term, width)}  ${row.description}`.trimEnd())
    .join("\n");
  return `${title}:\n${body}`;
}

export class HelpRenderer {
  constructor(command) {
    this.command = command;
  }

  usage() {
    const name = this.command._displayName();
    const optionUsage = this.command._options.length ? "[options]" : "";
    const subcommandUsage = this.command._commands.length ? "[command]" : "";
    const argumentUsage = this.command._arguments.map((arg) => arg.spec).join(" ");
    return [name, optionUsage, subcommandUsage, argumentUsage].filter(Boolean).join(" ");
  }

  render() {
    const lines = [`Usage: ${this.usage()}`];

    if (this.command._description) {
      lines.push("", this.command._description);
    }

    if (this.command._arguments.length) {
      lines.push(
        "",
        formatSection(
          "Arguments",
          this.command._arguments.map((argument) => ({
            term: argument.name,
            description: argument.description || ""
          }))
        )
      );
    }

    const optionRows = this.command._helpOptions();
    if (optionRows.length) {
      lines.push("", formatSection("Options", optionRows));
    }

    if (this.command._commands.length) {
      lines.push(
        "",
        formatSection(
          "Commands",
          this.command._commands.map((command) => ({
            term: command._commandSignature(),
            description: command._summary || command._description || ""
          }))
        )
      );
    }

    return lines.filter(Boolean).join("\n");
  }
}
