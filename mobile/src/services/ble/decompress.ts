// Shearwater dive payload uses 9-bit LRE (literal-or-run) compression XOR-folded
// over 32-byte rolling blocks. Manifest is uncompressed; dive data is.
// Ported from logbook/downloader/shearwater_download.py (decompress_lre/xor)
// — itself a port of libdivecomputer/src/shearwater_common.c.

import { MANIFEST } from "./constants";

export class DecompressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecompressError";
  }
}

// 9-bit LRE codes:
//   high bit (0x100) set → low 8 bits are a literal output byte
//   value == 0           → end-of-stream sentinel
//   otherwise            → emit `value` zero bytes (run-length)
//
// Each call appends to `out` and returns true when the EOS sentinel is hit.
// Bit count of each chunk must be a multiple of 9 (block boundary requirement).
export function decompressLre(data: Uint8Array, out: number[]): boolean {
  const nbits = data.length * 8;
  if (nbits % 9 !== 0) {
    throw new DecompressError(`LRE: bit count ${nbits} is not a multiple of 9`);
  }

  let offset = 0;
  while (offset + 9 <= nbits) {
    const bytePos = offset >> 3;
    const bitPos = offset & 7;
    const shift = 16 - (bitPos + 9);

    const hi = data[bytePos] << 8;
    const lo = bytePos + 1 < data.length ? data[bytePos + 1] : 0;
    const value = ((hi | lo) >> shift) & 0x1ff;

    if (value & 0x100) {
      out.push(value & 0xff);
    } else if (value === 0) {
      return true;
    } else {
      for (let i = 0; i < value; i++) out.push(0);
    }
    offset += 9;
  }
  return false;
}

// In-place XOR unfold: each 32-byte block is XOR-encoded against the previous
// block. After unfolding, plaintext records are at fixed 32-byte offsets.
export function xorUnfold(data: Uint8Array): Uint8Array {
  const block = MANIFEST.RECORD_SIZE;
  for (let i = block; i < data.length; i++) {
    data[i] ^= data[i - block];
  }
  return data;
}

// Streaming helper used by the download loop.
export class LreDecoder {
  private buf: number[] = [];
  private done = false;

  feed(chunk: Uint8Array): boolean {
    if (this.done) return true;
    this.done = decompressLre(chunk, this.buf);
    return this.done;
  }

  finalize(): Uint8Array {
    return xorUnfold(Uint8Array.from(this.buf));
  }

  get length(): number {
    return this.buf.length;
  }

  get isDone(): boolean {
    return this.done;
  }
}
