// Main Shearwater BLE client.
// Mirrors the ShearwaterBLE class in logbook/downloader/shearwater_download.py
// but uses react-native-ble-plx instead of bleak.

import { BleManager, Device } from "react-native-ble-plx";
import { SHEARWATER_BLE, DATA_ID, MANIFEST } from "./constants";

export type DeviceInfo = {
  serial: string;
  firmware: string;
  hardware: string;
  baseAddress: number;
};

export type ManifestEntry = {
  fingerprint: Uint8Array;
  diveAddress: number;
  isValid: boolean;
};

export class ShearwaterClient {
  private manager: BleManager;
  private device: Device | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  async scan(timeoutMs = 30_000): Promise<Device> {
    // TODO: scan for SHEARWATER_BLE.SERVICE_UUID, return first match
    throw new Error("scan() not implemented");
  }

  async connect(device: Device): Promise<void> {
    // TODO: connect + discover services + subscribe to notifications
    throw new Error("connect() not implemented");
  }

  async readDeviceInfo(): Promise<DeviceInfo> {
    // TODO: rdbi(ID_SERIAL), rdbi(ID_FIRMWARE), rdbi(ID_HARDWARE), rdbi(ID_LOGUPLOAD)
    throw new Error("readDeviceInfo() not implemented");
  }

  async downloadManifest(): Promise<ManifestEntry[]> {
    // TODO: download(MANIFEST.ADDR, MANIFEST.SIZE), parse 32-byte records
    throw new Error("downloadManifest() not implemented");
  }

  async downloadDive(address: number): Promise<Uint8Array> {
    // TODO: download(address) + decompress LRE/XOR
    throw new Error("downloadDive() not implemented");
  }

  async close(): Promise<void> {
    // TODO: wdbi(ID_CLOSE_SESSION, 0x00) + disconnect
    if (this.device) {
      await this.manager.cancelDeviceConnection(this.device.id);
      this.device = null;
    }
  }

  destroy(): void {
    this.manager.destroy();
  }
}
