# OpenTimestamps reference corpus

Copied unmodified from `opentimestamps/opentimestamps-client` (`examples/`, commit
`cd71c7609421bed2a07b9642a3c02a58c9fd2cdf`), LGPL-3.0. They are public test data,
contain no personal information, and are used only as test inputs (task M0-5).

| File | Reference outcome (python `opentimestamps` 0.4.5) |
|---|---|
| `hello-world.txt.ots` | Bitcoin attestation, block 358391 (valid) |
| `empty.ots` | Bitcoin attestation, block 129405, digest of empty input |
| `bad-stamp.txt.ots` | Claims block 358391 but commitment differs from that block's merkle root (invalid) |
| `incomplete.txt.ots` | Pending only (alice) |
| `two-calendars.txt.ots`, `merkle1/2.txt.ots` | Pending (alice + bob) |
| `unknown-notary.txt.ots` | Only an unknown attestation tag |
| `known-and-unknown-notary.txt.ots` | Pending (bob) + unknown attestation tag |
| `different-blockchains.txt.ots` | Pending on non-allowlisted calendars, Ethereum + Bitcoin (455605) |
| `invalid/*.ots` | Must be rejected by the parser |

Because block 358391's real merkle root is, by definition, the commitment that
`hello-world.txt.ots` replays to, tests use that value as the "real" header data
for 358391 when checking that `bad-stamp.txt.ots` is rejected.
