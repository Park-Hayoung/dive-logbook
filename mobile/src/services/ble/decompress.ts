// Shearwater dive payload uses LRE 9-bit RLE compression XOR-folded over
// 32-byte rolling blocks. Manifest is uncompressed.
// TODO: Port from shearwater_common.c (lre_decode + xor_decode).

export function decompressLreXor(_compressed: Uint8Array): Uint8Array {
  throw new Error("decompressLreXor not yet ported from libdivecomputer");
}
