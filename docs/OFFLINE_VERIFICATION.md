# Comparing a receipt with a trusted Bitcoin header offline

The optional Node CLI command checks a standard `.ots` receipt without contacting calendars or explorers:

```sh
node dist/unaltered-cli-0.3.1.mjs verify-offline FILE FILE.ots HEIGHT BLOCK_HASH HEADER.hex
```

`HEADER.hex` contains exactly the 160 hexadecimal characters for an 80-byte Bitcoin header, optionally ending in LF
or CRLF. `BLOCK_HASH` is the expected display-order hash from a source you trust, and `HEIGHT` is its unsigned block
height. Quote paths containing spaces. Neither file contents nor these arguments are uploaded.

Obtain the height-to-hash mapping and header from your own fully synced Bitcoin Core node. Confirm that
`bitcoin-cli getblockchaininfo` reports the intended main chain. Then replace the placeholders and run:

```sh
bitcoin-cli getblockhash HEIGHT
bitcoin-cli getblockheader BLOCK_HASH false > HEADER.hex
```

On Windows PowerShell 5, use `bitcoin-cli getblockheader BLOCK_HASH false | Set-Content -Encoding ascii HEADER.hex`
to avoid UTF-16 redirection.

Keep the expected hash separately with the header and receipt. Transfer those inputs to the offline machine through a
trusted channel. Supplying all inputs from an untrusted party does not make them trustworthy. A header alone cannot
establish its height, chain membership or chain identity; those remain assertions of your chosen evidence source.

The command validates the header hash, parses and replays bounded standard proof operations, compares the selected
file digest, requires a Bitcoin attestation at the supplied height, and compares its commitment with the header Merkle
root. Success is **MATCHED_TRUSTED_HEADER**, with trust **USER_SUPPLIED_HEADER**. It never grants the browser's
explorer-quorum `VERIFIED` state or claims to run Bitcoin consensus/full-node verification. The normal online `verify`
command still requires the existing independent explorer quorum. Pending receipts remain pending and need calendar
upgrade data before this command can match a Bitcoin header.

| Exit | Offline meaning |
|---|---|
| 0 | File/proof matched the supplied header |
| 1 | Usage, file access or other operation error |
| 2 | Receipt has no Bitcoin attestation |
| 3 | Selected file differs from receipt |
| 4 | Invalid/unsupported proof or resource limit |
| 5 | Replayed commitment differs from supplied Merkle root |
| 6 | No attestation names the supplied height |
| 7 | Invalid header size/hex/height/hash or mismatched expected hash |

Header input reads are capped before hashing the selected file; regular-file checks also reject idle FIFOs and devices.
The header timestamp is miner-supplied time, not the file's exact creation time. This feature does not prove authorship,
ownership or truthfulness. Its result remains only a comparison with the supplied trusted evidence.

Protocol references: Bitcoin Core 30.0
[getblockhash](https://bitcoincore.org/en/doc/30.0.0/rpc/blockchain/getblockhash/) and
[getblockheader](https://developer.bitcoin.org/reference/rpc/getblockheader.html).
No Bitcoin implementation code was copied, no new dependency added, and no own-node run is claimed by these source
checks. Tests include the known Bitcoin genesis header, synthetic end-to-end receipts, independent Node SHA-256,
malformed/mismatched inputs, proof replay and zero-network assertions.
