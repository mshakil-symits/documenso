const MAX_PATTERN_LENGTH = 200;
// A group that is itself repeated and holds a repeat: the shape of catastrophic backtracking, e.g. (a+)+
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[+*](?:[^()\\]|\\.)*\)[+*{]/;
// A repeated group that offers alternatives, e.g. (a|a)* : the other classic exponential shape
// A counted repeat on a group, e.g. (ab){3,}: bounded, but multiplies whatever is inside
const COUNTED_GROUP_REPEAT = /\)\{/;
const REPEATED_ALTERNATION = /\((?:[^()\\]|\\.)*\|(?:[^()\\]|\\.)*\)[+*{]/;

/**
 * Whether an author-supplied pattern is fit to run against a signer's input: short, compiles (as the
 * whole-value pattern it is used as), and has no nested repeats or repeated alternation. Not a full ReDoS analysis, so callers also
 * cap the length of the value they run it on.
 */
export const isSafeRegex = (pattern: string): boolean => {
  if (
    pattern.length > MAX_PATTERN_LENGTH ||
    NESTED_QUANTIFIER.test(pattern) ||
    REPEATED_ALTERNATION.test(pattern) ||
    COUNTED_GROUP_REPEAT.test(pattern)
  ) {
    return false;
  }

  try {
    new RegExp(`^(?:${pattern})$`);

    return true;
  } catch {
    return false;
  }
};
