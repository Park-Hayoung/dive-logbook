// Shearwater packet structure: [0xFF, 0x01, len, 0x00, ...payload]
// TODO: Port from shearwater_download.py build_request / parse_response.

export function buildRequest(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = 0x01;
  out[2] = payload.length;
  out[3] = 0x00;
  out.set(payload, 4);
  return out;
}

export function parseResponse(packet: Uint8Array): Uint8Array {
  if (packet.length < 4 || packet[0] !== 0xff || packet[1] !== 0x01) {
    throw new Error("Invalid Shearwater packet header");
  }
  const len = packet[2];
  return packet.slice(4, 4 + len);
}
