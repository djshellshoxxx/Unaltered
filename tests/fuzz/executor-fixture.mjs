// Deliberately faulty functions for checking the independent fuzz supervisor, never product input.
const hits = { taken: 0, other: 0 };
export function runCase(target, bytes) {
  if (target === 'hang') for (;;) { /* Parent must terminate a synchronous infinite loop. */ }
  if (target === 'throw') throw new RangeError('fixture exception');
  if (target === 'exit') process.exit(9);
  // V8 leaves out a block that runs exactly as often as its parent and joins equal-count neighbours,
  // so these shapes check that feedback follows executed code rather than reported range shapes.
  if (target === 'branch') { if (bytes[0] === 1) { hits.taken++; } else { hits.other++; } return 'accepted'; }
  if (target === 'loop') { for (const byte of bytes) if (byte) hits.taken++; else hits.other++; return 'accepted'; }
  if (target === 'nested') { const inner = () => { hits.taken++; }; if (bytes[0] === 1) inner(); return 'accepted'; }
  return target === 'reject' ? 'rejected' : 'accepted';
}
