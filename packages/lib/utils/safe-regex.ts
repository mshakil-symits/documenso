const MAX_PATTERN_LENGTH = 200;
// Quantifiers in one pattern, and how many of them may repeat without a small bound. Backtracking cost grows
// with the number of unbounded repeats (polynomially) and optional parts (exponentially), so both are capped.
const MAX_QUANTIFIERS = 16;
const MAX_UNBOUNDED = 2;
// A repeat counts as unbounded above this many; {1,100}{1,100}{1,100} backtracks like three stars.
const SMALL_BOUND = 20;

const QUANTIFIER_BRACES = /^\{(\d+)(?:(,)(\d*))?\}/;

/**
 * Whether an author-supplied pattern is fit to run against a signer's input.
 *
 * Instead of trying to spot every catastrophic shape, this accepts only a small, linear-ish subset: literals,
 * escapes (but no backreferences), character classes, alternation, groups, and quantifiers on single atoms.
 * A group may only be made optional (`?`), never repeated, so there are no nested repeats and no repeated
 * alternation; lookarounds and backreferences are refused; the number of quantifiers, and of unbounded ones,
 * is capped. Callers also cap the length of the value the pattern is run on.
 */
export const isSafeRegex = (pattern: string): boolean => {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    return false;
  }

  let quantifiers = 0;
  let unbounded = 0;
  let depth = 0;
  // What the previous token was, so a quantifier knows what it applies to
  let previous: 'none' | 'atom' | 'group' | 'quantifier' = 'none';

  const quantify = (max: number, onlyOptional: boolean): boolean => {
    if (previous === 'none' || previous === 'quantifier') {
      return false;
    }

    if (previous === 'group' && !onlyOptional) {
      return false;
    }

    quantifiers += 1;

    if (max > SMALL_BOUND) {
      unbounded += 1;
    }

    return quantifiers <= MAX_QUANTIFIERS && unbounded <= MAX_UNBOUNDED;
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
      if (!quantify(Number.POSITIVE_INFINITY, false)) {
        return false;
      }

      previous = 'quantifier';
    } else if (char === '?') {
      // A lazy marker after a quantifier changes nothing about the cost
      if (previous === 'quantifier') {
        continue;
      }

      if (!quantify(1, true)) {
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

      if (max < min || !quantify(max, false)) {
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
