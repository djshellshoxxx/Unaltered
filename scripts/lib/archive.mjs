// Deterministic archive writers (NFR-7): fixed timestamps, sorted entries, no owner data, platform-independent bytes.
import { gzipSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, i) => {
  let c = i;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const byName = (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/** Stored (uncompressed) zip. `mode` (e.g. 0o755) is recorded as Unix permissions so launchers stay executable. */
export function makeZip(entries) {
  const sorted = [...entries].sort(byName);
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data, mode } of sorted) {
    const nameB = Buffer.from(name, 'ascii');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time 00:00:00
    local.writeUInt16LE(0x0021, 12); // date 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameB.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameB, data);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(mode ? (3 << 8) | 20 : 20, 4); // made by: Unix when a mode is given
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0x0021, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(nameB.length, 28);
    if (mode) c.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38);
    c.writeUInt32LE(offset, 42);
    central.push(c, nameB);
    offset += local.length + nameB.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(cdSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

function tarHeader(name, size, mode) {
  const h = Buffer.alloc(512);
  if (Buffer.byteLength(name) > 100) throw new Error(`tar name too long: ${name}`);
  h.write(name, 0, 'ascii');
  h.write(mode.toString(8).padStart(7, '0') + '\0', 100, 'ascii');
  h.write('0000000\0', 108, 'ascii'); // uid
  h.write('0000000\0', 116, 'ascii'); // gid
  h.write(size.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  h.write('00000000000\0', 136, 'ascii'); // mtime = epoch
  h.write('        ', 148, 'ascii'); // checksum placeholder
  h.write('0', 156, 'ascii'); // regular file
  h.write('ustar\0' + '00', 257, 'ascii');
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return h;
}

/** ustar + gzip, byte-identical on every OS (gzip OS byte pinned to Unix). */
export function makeTarGz(entries) {
  const parts = [];
  for (const { name, data, mode } of [...entries].sort(byName)) {
    parts.push(tarHeader(name, data.length, mode ?? 0o644), data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  const gz = gzipSync(Buffer.concat(parts), { level: 9 });
  gz[4] = gz[5] = gz[6] = gz[7] = 0; // mtime
  gz[9] = 3; // OS = Unix
  return gz;
}
