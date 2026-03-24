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

function levenshteinDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => []);

  for (let i = 0; i <= left.length; i += 1) {
    rows[i][0] = i;
  }
  for (let j = 0; j <= right.length; j += 1) {
    rows[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[left.length][right.length];
}

export function suggestClosest(value, candidates) {
  if (!value || !candidates.length) return null;

  let bestCandidate = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = levenshteinDistance(value, candidate);
    if (distance < bestDistance) {
      bestCandidate = candidate;
      bestDistance = distance;
    }
  }

  const threshold = Math.max(2, Math.floor(value.length / 3));
  return bestDistance <= threshold ? bestCandidate : null;
}
