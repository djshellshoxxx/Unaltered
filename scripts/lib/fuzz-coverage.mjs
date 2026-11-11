// Reads V8 precise block coverage for the fuzz worker; dev-only, never product code.
/**
 * Source intervals [start, end) that ran in one case. V8 reports block ranges in a minimal form: it leaves out a nested
 * range whose count equals its parent's and joins neighbours with equal counts. So a branch that runs as often as its
 * function shows up only as the count-0 range of the branch that did not run, and range shapes change with counts.
 * Each offset therefore takes the count of the innermost reported range around it, across all of the script's
 * functions, since functions nest in the source as well.
 */
export function executedIntervals(functions) {
  const ranges = functions.flatMap((fn) => fn.ranges).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const executed = [];
  const open = [];
  let at = 0;
  const advance = (until) => {
    const inner = open.at(-1);
    if (inner && inner.count > 0 && until > at) executed.push([at, until]);
    at = until;
  };
  const close = () => { advance(open.at(-1).endOffset); open.pop(); };
  for (const range of ranges) {
    while (open.length && open.at(-1).endOffset <= range.startOffset) close();
    if (open.length && range.endOffset > open.at(-1).endOffset) throw new Error('Crossing V8 coverage ranges; refusing ambiguous feedback');
    advance(range.startOffset);
    open.push(range);
  }
  while (open.length) close();
  return executed;
}
