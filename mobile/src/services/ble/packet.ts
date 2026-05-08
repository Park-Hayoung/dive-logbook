// Shearwater outer packet framing.
// Request:  [0xFF, 0x01, len(payload)+1, 0x00, ...payload]
// Response: [0x01, 0xFF, len(payload)+1, 0x00, ...payload]
// Note the byte order of the first two bytes flips between request and response.
// Mirrors build_request / parse_response in shearwater_download.py.

export class PacketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PacketError";
  }
}

export function buildRequest(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xff;
  out[1] = 0x01;
  out[2] = payload.length + 1;
  out[3] = 0x00;
  out.set(payload, 4);
  return out;
}

export function parseResponse(data: Uint8Array): Uint8Array {
  if (data.length < 4) {
    throw new PacketError(`Response too short: ${data.length} bytes`);
  }
  if (data[0] !== 0x01 || data[1] !== 0xff || data[3] !== 0x00) {
    const head = Array.from(data.slice(0, 4))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    throw new PacketError(`Invalid response header: ${head}`);
  }
  const length = data[2];
  if (length < 1) {
    throw new PacketError(`Invalid response length: ${length}`);
  }
  return data.slice(4, 4 + length - 1);
}
