// Shearwater Peregrine BLE protocol constants.
// Ported from logbook/downloader/shearwater_download.py
// Reference: libdivecomputer/src/shearwater_common.{c,h}, shearwater_petrel.c

export const SHEARWATER_BLE = {
  SERVICE_UUID: "fe25c237-0ece-443c-b0aa-e02033e7029d",
  CHAR_UUID: "27b7570b-359e-45a3-91bb-cf7e70049bd2",
  DEVICE_NAME: "Peregrine",
} as const;

export const SLIP = {
  END: 0xc0,
  ESC: 0xdb,
  ESC_END: 0xdc,
  ESC_ESC: 0xdd,
} as const;

export const PACKET = {
  SZ_PACKET: 254,
  BLE_FRAME_SIZE: 32,
  BLE_PAYLOAD_PER_FRAME: 30,
} as const;

export const RDBI = {
  REQUEST: 0x22,
  RESPONSE: 0x62,
} as const;

export const WDBI = {
  REQUEST: 0x2e,
  RESPONSE: 0x6e,
} as const;

export const NAK = 0x7f;

export const DOWNLOAD = {
  INIT: 0x35,
  INIT_RESP: 0x75,
  BLOCK: 0x36,
  BLOCK_RESP: 0x76,
  QUIT: 0x37,
  QUIT_RESP: 0x77,
} as const;

export const DATA_ID = {
  SERIAL: 0x8010,
  FIRMWARE: 0x8011,
  LOGUPLOAD: 0x8021,
  HARDWARE: 0x8050,
  CLOSE_SESSION: 0x9020,
} as const;

export const MANIFEST = {
  ADDR: 0xe0000000,
  SIZE: 0x600,
  RECORD_SIZE: 0x20,
  RECORD_COUNT: 0x600 / 0x20,
  HEADER_VALID: 0xa5c4,
  HEADER_DELETED: 0x5a23,
  FINGERPRINT_OFFSET: 4,
  ADDRESS_OFFSET: 20,
} as const;

export const DIVE = {
  MAX_SIZE: 0xffffff,
} as const;
