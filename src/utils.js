export function camelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function pad(value, width) {
  if (value.length >= width) return value;
  return value + " ".repeat(width - value.length);
}

export function stripAngleBrackets(value) {
  return value.replace(/[<[>\]]/g, "");
}
