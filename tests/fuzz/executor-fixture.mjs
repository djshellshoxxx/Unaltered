// Deliberately faulty functions for checking the independent fuzz supervisor, never product input.
export function runCase(target) {
  if (target === 'hang') for (;;) { /* Parent must terminate a synchronous infinite loop. */ }
  if (target === 'throw') throw new RangeError('fixture exception');
  if (target === 'exit') process.exit(9);
  return target === 'reject' ? 'rejected' : 'accepted';
}
