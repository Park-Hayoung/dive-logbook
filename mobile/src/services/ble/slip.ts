import { SLIP, PACKET } from "./constants";

// SLIP encode + split into 32-byte BLE frames with [nframes, counter] header.
// Mirrors slip_encode_ble() in shearwater_download.py.
export function slipEncodeBle(data: Uint8Array): Uint8Array[] {
  const encoded: number[] = [];
  for (const b of data) {
    if (b === SLIP.END) {
      encoded.push(SLIP.ESC, SLIP.ESC_END);
    } else if (b === SLIP.ESC) {
      encoded.push(SLIP.ESC, SLIP.ESC_ESC);
    } else {
      encoded.push(b);
    }
  }
  encoded.push(SLIP.END);

  const nframes = Math.ceil(encoded.length / PACKET.BLE_PAYLOAD_PER_FRAME);
  const frames: Uint8Array[] = [];
  let offset = 0;
  let counter = 0;

  while (offset < encoded.length) {
    const chunk = encoded.slice(offset, offset + PACKET.BLE_PAYLOAD_PER_FRAME);
    const frame = new Uint8Array(2 + chunk.length);
    frame[0] = nframes;
    frame[1] = counter;
    frame.set(chunk, 2);
    frames.push(frame);
    offset += PACKET.BLE_PAYLOAD_PER_FRAME;
    counter++;
  }
  return frames;
}

// Decode SLIP-framed payload back to raw bytes.
// Strips trailing END byte and unescapes ESC sequences.
export function slipDecode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === SLIP.END) break;
    if (b === SLIP.ESC) {
      const next = data[++i];
      if (next === SLIP.ESC_END) out.push(SLIP.END);
      else if (next === SLIP.ESC_ESC) out.push(SLIP.ESC);
      else throw new Error(`Invalid SLIP escape: 0x${next.toString(16)}`);
    } else {
      out.push(b);
    }
  }
  return new Uint8Array(out);
}
