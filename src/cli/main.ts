import { run } from './run';

// A failed write (full disk, closed pipe) would otherwise be an uncaught stream error whose stack trace names paths (SR-8).
let writeFailed = false;
process.stdout.on('error', () => {
  if (!writeFailed) process.stderr.write('error: could not write the output\n');
  writeFailed = true;
  process.exitCode = 1;
});
process.stderr.on('error', () => {
  writeFailed = true;
  process.exitCode = 1;
});

const code = await run(process.argv.slice(2), {
  out: (s) => void process.stdout.write(s),
  err: (s) => void process.stderr.write(s),
});
// The error event may arrive before or after run() returns; either way the exit code reports the failure.
process.exitCode = writeFailed ? 1 : code;
