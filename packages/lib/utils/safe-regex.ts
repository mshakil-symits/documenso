const MAX_PATTERN_LENGTH = 200;
// Optional parts multiply backtracking too, so the number of quantifiers is capped as well.
const MAX_QUANTIFIERS = 16;
// Worst-case backtracking is about the product of how many ways each quantifier can match, so that product is
// capped. An open-ended repeat counts as the longest value a pattern is ever run on.
const MAX_COMBINATIONS = 1_000_000;
const OPEN_ENDED = 500;

const QUANTIFIER_BRACES = /^\{(\d+)(?:(,)(\d*))?\}/;

/**
 * Whether an author-supplied pattern is fit to run against a signer's input.
 *
 * Instead of trying to spot every catastrophic shape, this accepts only a small, linear-ish subset: literals,
 * escapes (but no backreferences), character classes, alternation, groups, and quantifiers on single atoms.
 * A group may only be made optional (`?`), never repeated, so there are no nested repeats and no repeated
 * alternation; lookarounds and backreferences are refused; the number of quantifiers and the product of their ranges are capped. Callers also cap the length of the value the pattern is run on.
 */
export const isSafeRegex = (pattern: string): boolean => {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  let quantifiers = 0;
  let combinations = 1;
  let depth = 0;
  // What the previous token was, so a quantifier knows what it applies to
  let previous: 'none' | 'atom' | 'group' | 'quantifier' = 'none';

  const quantify = (min: number, max: number, onlyOptional: boolean): boolean => {
    if (previous === 'none' || previous === 'quantifier') {
      return false;
    }

    if (previous === 'group' && !onlyOptional) {
      return false;
    }

    quantifiers += 1;

    combinations *= Math.max(1, Math.min(max, OPEN_ENDED) - min + 1);

    return quantifiers <= MAX_QUANTIFIERS && combinations <= MAX_COMBINATIONS;
  };

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];

    if (char === '\\') {
      const next = pattern[i + 1] ?? '';

      // Backreferences and named backreferences
      if (/[1-9]/.test(next) || next === 'k') {
        return false;
      }

      i += 1;
      previous = 'atom';
    } else if (char === '[') {
      let closed = false;

      for (i += 1; i < pattern.length; i += 1) {
        if (pattern[i] === '\\') {
          i += 1;
        } else if (pattern[i] === ']') {
          closed = true;
          break;
        }
      }

      if (!closed) {
        return false;
      }

      previous = 'atom';
    } else if (char === '(') {
      if (pattern[i + 1] === '?') {
        // Only non-capturing groups: no lookahead, lookbehind or named groups
        if (pattern.slice(i, i + 3) !== '(?:') {
          return false;
        }

        i += 2;
      }

      depth += 1;
      previous = 'none';
    } else if (char === ')') {
      depth -= 1;

      if (depth < 0) {
        return false;
      }

      previous = 'group';
    } else if (char === '|') {
      previous = 'none';
    } else if (char === '*' || char === '+') {
      if (!quantify(0, Number.POSITIVE_INFINITY, false)) {
        return false;
      }

      previous = 'quantifier';
    } else if (char === '?') {
      // A lazy marker after a quantifier changes nothing about the cost
      if (previous === 'quantifier') {
        continue;
      }

      if (!quantify(0, 1, true)) {
        return false;
      }

      previous = 'quantifier';
    } else if (char === '{') {
      const match = QUANTIFIER_BRACES.exec(pattern.slice(i));

      if (!match) {
        // A literal brace
        previous = 'atom';
        continue;
      }

      const min = Number(match[1]);
      const max = match[2] ? (match[3] ? Number(match[3]) : Number.POSITIVE_INFINITY) : min;

      if (max < min || !quantify(min, max, false)) {
        return false;
      }

      i += match[0].length - 1;
      previous = 'quantifier';
    } else {
      previous = 'atom';
    }
  }

  if (depth !== 0) {
    return false;
  }

  try {
    new RegExp(`^(?:${pattern})$`);

    return true;
  } catch {
    return false;
  }
};
