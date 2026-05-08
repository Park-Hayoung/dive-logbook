// Main Shearwater BLE client.
// Mirrors the ShearwaterBLE class in logbook/downloader/shearwater_download.py
// using react-native-ble-plx instead of bleak.

import {
  BleManager,
  Device,
  Subscription,
  Characteristic,
} from "react-native-ble-plx";
import { decode as b64Decode, encode as b64Encode } from "base64-arraybuffer";

import {
  SHEARWATER_BLE,
  DATA_ID,
  MANIFEST,
  RDBI,
  WDBI,
  NAK,
  DOWNLOAD,
  DIVE,
} from "./constants";
import { slipEncodeBle, slipDecode } from "./slip";
import { buildRequest, parseResponse } from "./packet";
import { LreDecoder } from "./decompress";

export type DeviceInfo = {
  serial: string;
  firmware: string;
  hardware: number;
  baseAddress: number;
};

export type ManifestEntry = {
  diveNumber: number;
  fingerprint: Uint8Array;
  address: number;
};

export type DownloadProgress = {
  label: string;
  bytesReceived: number;
  totalBytes: number;
  block: number;
};

export class BleProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BleProtocolError";
  }
}

export class BleConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BleConnectionError";
  }
}

const DEFAULT_RX_TIMEOUT_MS = 5_000;
const DOWNLOAD_INIT_TIMEOUT_MS = 10_000;
const DOWNLOAD_BLOCK_TIMEOUT_MS = 15_000;

function u8FromBase64(b64: string): Uint8Array {
  return new Uint8Array(b64Decode(b64));
}
function base64FromU8(data: Uint8Array): string {
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  return b64Encode(buf);
}
function be32(data: Uint8Array, offset = 0): number {
  return (
    ((data[offset] << 24) >>> 0) +
    (data[offset + 1] << 16) +
    (data[offset + 2] << 8) +
    data[offset + 3]
  );
}
function be16(data: Uint8Array, offset = 0): number {
  return (data[offset] << 8) | data[offset + 1];
}
function bytesToHex(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join(" ");
}
function asciiDecode(bytes: Uint8Array): string {
  // Hermes' TextDecoder does not accept the "ascii" label. Construct manually.
  let s = "";
  for (const b of bytes) {
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s.replace(/\s+$/g, "");
}

export class ShearwaterClient {
  private manager: BleManager;
  private device: Device | null = null;
  private notifSub: Subscription | null = null;

  // Single-receiver model: at most one in-flight RX waiter at a time.
  // Notifications append to rxBuffer until a SLIP END byte arrives, then
  // the pending waiter is resolved.
  private rxBuffer: number[] = [];
  private rxResolver: ((data: Uint8Array) => void) | null = null;
  private rxRejecter: ((err: Error) => void) | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  async scan(timeoutMs = 30_000): Promise<Device> {
    return new Promise<Device>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.manager.stopDeviceScan();
        reject(
          new BleConnectionError(
            "Peregrine TX를 찾을 수 없습니다. 다이브 컴퓨터가 Bluetooth 모드인지 확인하세요.",
          ),
        );
      }, timeoutMs);

      this.manager.startDeviceScan(null, null, (error, device) => {
        if (settled) return;
        if (error) {
          settled = true;
          clearTimeout(timer);
          this.manager.stopDeviceScan();
          reject(new BleConnectionError(`스캔 실패: ${error.message}`));
          return;
        }
        if (!device) return;
        const name = device.name ?? device.localName ?? "";
        if (name.includes(SHEARWATER_BLE.DEVICE_NAME)) {
          settled = true;
          clearTimeout(timer);
          this.manager.stopDeviceScan();
          resolve(device);
        }
      });
    });
  }

  async connect(device: Device): Promise<void> {
    console.log("[BLE] connect() start");
    this.device = await device.connect({ timeout: 15_000 });
    console.log("[BLE] connected, requesting MTU...");

    // Android often connects with ATT MTU=23 (20 byte payload). Our protocol
    // sends 32-byte BLE frames so we need MTU >= 35 (32 + 3 ATT header).
    try {
      this.device = await this.device.requestMTU(247);
      console.log("[BLE] MTU requested");
    } catch (e) {
      console.log("[BLE] MTU request failed (continuing with default):", e);
    }

    this.device = await this.device.discoverAllServicesAndCharacteristics();
    console.log("[BLE] services discovered");

    const targetChar = await this.findCharacteristic();
    if (!targetChar) {
      throw new BleConnectionError(
        "Notify 가능한 Shearwater 특성을 찾을 수 없습니다.",
      );
    }
    console.log(
      "[BLE] target char:",
      targetChar.uuid,
      "notifiable:",
      targetChar.isNotifiable,
      "writeWoResp:",
      targetChar.isWritableWithoutResponse,
    );

    this.notifSub = targetChar.monitor((error, ch) => {
      if (error) {
        console.log("[BLE] monitor error:", error.message);
        if (this.rxRejecter) {
          const reject = this.rxRejecter;
          this.rxResolver = null;
          this.rxRejecter = null;
          reject(error);
        }
        return;
      }
      if (!ch?.value) return;
      const bytes = u8FromBase64(ch.value);
      console.log("[BLE] rx frame:", bytesToHex(bytes));
      this.handleNotification(bytes);
    });

    // Settle pause after notify start to give Android time to write CCCD.
    await sleep(600);
    console.log("[BLE] connect() done, ready for transfers");
  }

  private async findCharacteristic(): Promise<Characteristic | null> {
    if (!this.device) return null;
    const services = await this.device.services();
    for (const svc of services) {
      if (
        svc.uuid.toLowerCase() !== SHEARWATER_BLE.SERVICE_UUID.toLowerCase()
      ) {
        continue;
      }
      const chars = await svc.characteristics();
      for (const c of chars) {
        if (c.uuid.toLowerCase() === SHEARWATER_BLE.CHAR_UUID.toLowerCase()) {
          return c;
        }
      }
    }
    for (const svc of services) {
      const chars = await svc.characteristics();
      for (const c of chars) {
        if (c.isNotifiable) return c;
      }
    }
    return null;
  }

  private handleNotification(frame: Uint8Array) {
    if (frame.length < 2) return;
    // Strip 2-byte BLE header [nframes, counter] and append SLIP bytes.
    for (let i = 2; i < frame.length; i++) this.rxBuffer.push(frame[i]);
    // SLIP frames terminate with 0xC0 (END).
    if (frame.includes(0xc0) && this.rxResolver) {
      const buf = Uint8Array.from(this.rxBuffer);
      this.rxBuffer.length = 0;
      const resolve = this.rxResolver;
      this.rxResolver = null;
      this.rxRejecter = null;
      resolve(buf);
    }
  }

  private async receive(timeoutMs: number): Promise<Uint8Array> {
    if (this.rxResolver) {
      throw new BleProtocolError("RX 충돌: 이전 응답을 아직 처리 중입니다");
    }
    this.rxBuffer.length = 0;

    const raw = await new Promise<Uint8Array>((resolve, reject) => {
      this.rxResolver = resolve;
      this.rxRejecter = reject;
      setTimeout(() => {
        if (this.rxResolver === resolve) {
          this.rxResolver = null;
          this.rxRejecter = null;
          reject(new BleProtocolError("응답 타임아웃"));
        }
      }, timeoutMs);
    });

    const decoded = slipDecode(raw);
    return parseResponse(decoded);
  }

  private async send(payload: Uint8Array): Promise<void> {
    if (!this.device) throw new BleConnectionError("연결되지 않음");
    const packet = buildRequest(payload);
    const frames = slipEncodeBle(packet);
    console.log(
      "[BLE] tx packet:",
      bytesToHex(packet),
      `(${frames.length} frame(s))`,
    );
    for (const frame of frames) {
      console.log("[BLE] tx frame:", bytesToHex(frame));
      await this.device.writeCharacteristicWithoutResponseForService(
        SHEARWATER_BLE.SERVICE_UUID,
        SHEARWATER_BLE.CHAR_UUID,
        base64FromU8(frame),
      );
    }
  }

  private async transfer(
    payload: Uint8Array,
    opts: { expectResponse?: boolean; timeoutMs?: number } = {},
  ): Promise<Uint8Array> {
    const { expectResponse = true, timeoutMs = DEFAULT_RX_TIMEOUT_MS } = opts;
    await this.send(payload);
    if (!expectResponse) return new Uint8Array();
    return this.receive(timeoutMs);
  }

  async rdbi(dataId: number): Promise<Uint8Array> {
    const req = new Uint8Array([
      RDBI.REQUEST,
      (dataId >> 8) & 0xff,
      dataId & 0xff,
    ]);
    const resp = await this.transfer(req);
    if (resp.length < 3) {
      throw new BleProtocolError(`RDBI 응답이 너무 짧음: ${resp.length}`);
    }
    if (resp[0] === NAK) {
      throw new BleProtocolError(
        `NAK on RDBI 0x${dataId.toString(16)}: 0x${resp[2].toString(16)}`,
      );
    }
    if (resp[0] !== RDBI.RESPONSE) {
      throw new BleProtocolError(
        `예상치 못한 RDBI 응답: 0x${resp[0].toString(16)}`,
      );
    }
    const respId = (resp[1] << 8) | resp[2];
    if (respId !== dataId) {
      throw new BleProtocolError(
        `RDBI ID 불일치: 0x${dataId.toString(16)} vs 0x${respId.toString(16)}`,
      );
    }
    return resp.slice(3);
  }

  async wdbi(
    dataId: number,
    data: Uint8Array,
    opts: { expectResponse?: boolean } = {},
  ): Promise<void> {
    const req = new Uint8Array(3 + data.length);
    req[0] = WDBI.REQUEST;
    req[1] = (dataId >> 8) & 0xff;
    req[2] = dataId & 0xff;
    req.set(data, 3);
    await this.transfer(req, { expectResponse: opts.expectResponse });
  }

  async readDeviceInfo(): Promise<DeviceInfo> {
    const serialBytes = await this.rdbi(DATA_ID.SERIAL);
    const firmwareBytes = await this.rdbi(DATA_ID.FIRMWARE);
    const hardwareBytes = await this.rdbi(DATA_ID.HARDWARE);
    const loguploadBytes = await this.rdbi(DATA_ID.LOGUPLOAD);

    const serial = Array.from(serialBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const firmware = asciiDecode(firmwareBytes);
    const hardware = be16(hardwareBytes);

    let baseAddress = be32(loguploadBytes, 1);
    if (
      baseAddress === 0xdd000000 ||
      baseAddress === 0xc0000000 ||
      baseAddress === 0x90000000
    ) {
      baseAddress = 0xc0000000;
    } else if (baseAddress === 0x80000000) {
      // ok
    } else {
      // Unknown — fall back to 0x80000000 like the Python tool does.
      baseAddress = 0x80000000;
    }

    console.log(
      "[BLE] device info:",
      JSON.stringify({
        serial,
        firmware,
        hardware: `0x${hardware.toString(16)}`,
        baseAddress: `0x${baseAddress.toString(16)}`,
      }),
    );

    return { serial, firmware, hardware, baseAddress };
  }

  async download(
    address: number,
    size: number,
    compression: boolean,
    onProgress?: (p: DownloadProgress) => void,
    label = "",
  ): Promise<Uint8Array> {
    const req = new Uint8Array([
      DOWNLOAD.INIT,
      compression ? 0x10 : 0x00,
      0x34,
      (address >>> 24) & 0xff,
      (address >>> 16) & 0xff,
      (address >>> 8) & 0xff,
      address & 0xff,
      (size >>> 16) & 0xff,
      (size >>> 8) & 0xff,
      size & 0xff,
    ]);
    const initResp = await this.transfer(req, {
      timeoutMs: DOWNLOAD_INIT_TIMEOUT_MS,
    });
    if (initResp.length < 3 || initResp[0] !== DOWNLOAD.INIT_RESP) {
      throw new BleProtocolError(
        `예상치 못한 init 응답: 0x${initResp[0]?.toString(16)}`,
      );
    }

    const lre = compression ? new LreDecoder() : null;
    const raw: number[] = [];
    let block = 1;
    let bytesReceived = 0;
    let done = false;

    while (bytesReceived < size && !done) {
      const blockReq = new Uint8Array([DOWNLOAD.BLOCK, block & 0xff]);
      const blockResp = await this.transfer(blockReq, {
        timeoutMs: DOWNLOAD_BLOCK_TIMEOUT_MS,
      });
      if (blockResp.length < 2 || blockResp[0] !== DOWNLOAD.BLOCK_RESP) {
        throw new BleProtocolError(
          `예상치 못한 block 응답: 0x${blockResp[0]?.toString(16)}`,
        );
      }
      if (blockResp[1] !== (block & 0xff)) {
        throw new BleProtocolError(
          `Block 번호 불일치: ${block & 0xff} vs ${blockResp[1]}`,
        );
      }

      const chunk = blockResp.slice(2);
      if (compression && lre) {
        done = lre.feed(chunk);
      } else {
        for (const b of chunk) raw.push(b);
      }
      bytesReceived += chunk.length;
      block += 1;

      onProgress?.({ label, bytesReceived, totalBytes: size, block });
    }

    // Quit
    const quitResp = await this.transfer(new Uint8Array([DOWNLOAD.QUIT]), {
      timeoutMs: DOWNLOAD_INIT_TIMEOUT_MS,
    });
    if (
      quitResp.length < 2 ||
      quitResp[0] !== DOWNLOAD.QUIT_RESP ||
      quitResp[1] !== 0x00
    ) {
      // Match Python: warn but don't fail — some firmware variants are loose here.
    }

    return compression && lre ? lre.finalize() : Uint8Array.from(raw);
  }

  async downloadManifest(): Promise<ManifestEntry[]> {
    const data = await this.download(MANIFEST.ADDR, MANIFEST.SIZE, false);
    return parseManifest(data);
  }

  async downloadDive(
    entry: ManifestEntry,
    baseAddress: number,
    onProgress?: (p: DownloadProgress) => void,
  ): Promise<Uint8Array> {
    return this.download(
      baseAddress + entry.address,
      DIVE.MAX_SIZE,
      true,
      onProgress,
      `DIVE #${entry.diveNumber}`,
    );
  }

  async close(): Promise<void> {
    try {
      await this.wdbi(DATA_ID.CLOSE_SESSION, new Uint8Array([0x00]), {
        expectResponse: false,
      });
      await sleep(200);
    } catch {
      /* ignore */
    }
    try {
      this.notifSub?.remove();
      this.notifSub = null;
    } catch {
      /* ignore */
    }
    if (this.device) {
      try {
        await this.manager.cancelDeviceConnection(this.device.id);
      } catch {
        /* ignore */
      }
      this.device = null;
    }
  }

  destroy(): void {
    this.manager.destroy();
  }
}

// 32-byte records: header(0,2B) [0xA5C4 valid / 0x5A23 deleted],
// fingerprint(4,4B BE) = dive number, address(20,4B BE).
export function parseManifest(data: Uint8Array): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  for (
    let off = 0;
    off + MANIFEST.RECORD_SIZE <= data.length;
    off += MANIFEST.RECORD_SIZE
  ) {
    const header = be16(data, off);
    if (header === MANIFEST.HEADER_DELETED) continue;
    if (header !== MANIFEST.HEADER_VALID) break;

    const fingerprint = data.slice(
      off + MANIFEST.FINGERPRINT_OFFSET,
      off + MANIFEST.FINGERPRINT_OFFSET + 4,
    );
    const address = be32(data, off + MANIFEST.ADDRESS_OFFSET);
    const diveNumber = be32(fingerprint);

    entries.push({ diveNumber, fingerprint, address });
  }
  return entries;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
