// Data model for OpenTimestamps proofs. Constants are taken from python-opentimestamps
// (opentimestamps/core/{op,notary,timestamp}.py), NOT from secondary sources; see docs/NETWORK.md.

export type Op =
  | { readonly kind: 'sha256' }
  | { readonly kind: 'append'; readonly arg: Uint8Array }
  | { readonly kind: 'prepend'; readonly arg: Uint8Array };

export type Attestation =
  | { readonly kind: 'pending'; readonly uri: string }
  | { readonly kind: 'bitcoin'; readonly height: number };

export interface TsNode {
  /** The message (commitment) at this point of the proof. */
  readonly msg: Uint8Array;
  attestations: Attestation[];
  children: { op: Op; node: TsNode }[];
}

export interface DetachedProof {
  /** SHA-256 digest of the stamped file. */
  readonly digest: Uint8Array;
  readonly root: TsNode;
}

export type ProofStatus = 'pending' | 'bitcoin-confirmed';

// Wire constants (python-opentimestamps)
export const HEADER_MAGIC = Uint8Array.from([
  0x00, 0x4f, 0x70, 0x65, 0x6e, 0x54, 0x69, 0x6d, 0x65, 0x73, 0x74, 0x61, 0x6d, 0x70, 0x73, 0x00, 0x00, 0x50, 0x72, 0x6f, 0x6f, 0x66, 0x00, 0xbf, 0x89, 0xe2, 0xe8, 0x84, 0xe8, 0x92, 0x94,
]); // "\x00OpenTimestamps\x00\x00Proof\x00\xbf\x89\xe2\xe8\x84\xe8\x92\x94"
export const MAJOR_VERSION = 1;
export const TAG_SHA256 = 0x08;
export const TAG_APPEND = 0xf0;
export const TAG_PREPEND = 0xf1;
export const TAG_ATTESTATION = 0x00;
export const TAG_MORE = 0xff;
export const ATT_PENDING = Uint8Array.from([0x83, 0xdf, 0xe3, 0x0d, 0x2e, 0xf9, 0x0c, 0x8e]);
export const ATT_BITCOIN = Uint8Array.from([0x05, 0x88, 0x96, 0x0d, 0x73, 0xd7, 0x19, 0x01]);

// Ops python knows but we deliberately reject (fail closed, SR-12).
export const TAGS_KNOWN_UNSUPPORTED = new Set([0x02 /* sha1 */, 0x03 /* ripemd160 */, 0x67 /* keccak256 */, 0xf2 /* reverse */, 0xf3 /* hexlify */]);
// Attestation tags python knows but we do not verify.
export const ATTS_KNOWN_UNSUPPORTED = [
  { tag: Uint8Array.from([0x06, 0x86, 0x9a, 0x0d, 0x73, 0xd7, 0x1b, 0x45]), name: 'Litecoin' },
  { tag: Uint8Array.from([0x30, 0xfe, 0x80, 0x87, 0xb5, 0xc7, 0xea, 0xd7]), name: 'Ethereum' },
];

// Parser caps (SPEC section 6). Python uses MAX_PAYLOAD 8192, MAX_URI 1000, MAX_RESULT 4096, recursion 256.
export const LIMITS = {
  maxInputBytes: 1024 * 1024,
  maxNodes: 20_000,
  maxDepth: 256,
  maxOpArg: 4096,
  maxMsg: 4096,
  maxAttPayload: 8192,
  maxUri: 1000,
  /** Real proofs hold a handful; this bounds network fan-out and merge work from hostile input. */
  maxAttestations: 256,
  maxDistinctBitcoin: 16,
} as const;
