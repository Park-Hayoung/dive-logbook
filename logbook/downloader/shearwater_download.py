#!/usr/bin/env python3
"""
Shearwater Peregrine TX BLE Dive Data Downloader

Connects to a Shearwater Peregrine TX dive computer via Bluetooth Low Energy
and downloads dive data using the Shearwater protocol (ported from libdivecomputer).
"""

import asyncio
import struct
import sys
import os
import argparse
from datetime import datetime

from bleak import BleakClient, BleakScanner

# ============================================================================
# Constants
# ============================================================================

# BLE UUIDs
SERVICE_UUID = "fe25c237-0ece-443c-b0aa-e02033e7029d"
CHAR_UUID = "27b7570b-359e-45a3-91bb-cf7e70049bd2"

# SLIP framing
END = 0xC0
ESC = 0xDB
ESC_END = 0xDC
ESC_ESC = 0xDD

# Packet
SZ_PACKET = 254
BLE_FRAME_SIZE = 32

# RDBI/WDBI
RDBI_REQUEST = 0x22
RDBI_RESPONSE = 0x62
WDBI_REQUEST = 0x2E
WDBI_RESPONSE = 0x6E
NAK = 0x7F

# Download protocol
DL_INIT = 0x35
DL_INIT_RESP = 0x75
DL_BLOCK = 0x36
DL_BLOCK_RESP = 0x76
DL_QUIT = 0x37
DL_QUIT_RESP = 0x77

# Data IDs
ID_SERIAL = 0x8010
ID_FIRMWARE = 0x8011
ID_LOGUPLOAD = 0x8021
ID_HARDWARE = 0x8050

# Manifest
MANIFEST_ADDR = 0xE0000000
MANIFEST_SIZE = 0x600
RECORD_SIZE = 0x20
RECORD_COUNT = MANIFEST_SIZE // RECORD_SIZE

# Dive
DIVE_SIZE = 0xFFFFFF

# Manifest record headers
HEADER_VALID = 0xA5C4
HEADER_DELETED = 0x5A23


# ============================================================================
# SLIP Encoding/Decoding (BLE variant)
# ============================================================================

def slip_encode_ble(data: bytes) -> list:
    """Encode data with SLIP framing for BLE transport.
    Returns a list of BLE frames (each up to 32 bytes).
    """
    # SLIP encode
    encoded = bytearray()
    for b in data:
        if b == END:
            encoded.append(ESC)
            encoded.append(ESC_END)
        elif b == ESC:
            encoded.append(ESC)
            encoded.append(ESC_ESC)
        else:
            encoded.append(b)
    encoded.append(END)

    # Calculate nframes (matches libdivecomputer formula)
    count = len(encoded)
    nframes = (count + BLE_FRAME_SIZE - 1) // BLE_FRAME_SIZE

    # Split into BLE frames with 2-byte header
    frames = []
    offset = 0
    frame_counter = 0
    payload_per_frame = BLE_FRAME_SIZE - 2  # 30 bytes

    while offset < len(encoded):
        chunk = encoded[offset:offset + payload_per_frame]
        frame = bytes([nframes, frame_counter]) + bytes(chunk)
        frames.append(frame)
        offset += payload_per_frame
        frame_counter += 1

    return frames


def slip_decode(raw_data: bytearray) -> bytes:
    """Decode SLIP-encoded data (after stripping BLE headers)."""
    result = bytearray()
    escaped = False

    for b in raw_data:
        if escaped:
            if b == ESC_END:
                result.append(END)
            elif b == ESC_ESC:
                result.append(ESC)
            else:
                result.append(b)
            escaped = False
        elif b == ESC:
            escaped = True
        elif b == END:
            break
        else:
            result.append(b)

    return bytes(result)


# ============================================================================
# Packet Layer
# ============================================================================

def build_request(payload: bytes) -> bytes:
    """Build a Shearwater request packet."""
    return bytes([0xFF, 0x01, len(payload) + 1, 0x00]) + payload


def parse_response(data: bytes) -> bytes:
    """Parse a Shearwater response packet. Returns the payload."""
    if len(data) < 4:
        raise ProtocolError(f"Response too short: {len(data)} bytes")
    if data[0] != 0x01 or data[1] != 0xFF or data[3] != 0x00:
        raise ProtocolError(f"Invalid response header: {data[:4].hex()}")

    length = data[2]
    if length < 1:
        raise ProtocolError(f"Invalid response length: {length}")

    payload = data[4:4 + length - 1]
    return payload


class ProtocolError(Exception):
    pass


# ============================================================================
# Decompression
# ============================================================================

def decompress_lre(data: bytes, buffer: bytearray) -> bool:
    """LRE (9-bit RLE) decompression. Returns True if end-of-stream reached."""
    nbits = len(data) * 8
    if nbits % 9 != 0:
        raise ProtocolError(f"LRE: bit count {nbits} is not a multiple of 9")

    offset = 0
    while offset + 9 <= nbits:
        byte_pos = offset // 8
        bit_pos = offset % 8
        shift = 16 - (bit_pos + 9)

        if byte_pos + 1 < len(data):
            value = (data[byte_pos] << 8 | data[byte_pos + 1]) >> shift & 0x1FF
        else:
            value = (data[byte_pos] << 8) >> shift & 0x1FF

        if value & 0x100:
            buffer.append(value & 0xFF)
        elif value == 0:
            return True  # End of stream
        else:
            buffer.extend(b'\x00' * value)

        offset += 9

    return False


def decompress_xor(data: bytearray) -> bytearray:
    """XOR decompression (32-byte block XOR with previous block)."""
    for i in range(RECORD_SIZE, len(data)):
        data[i] ^= data[i - RECORD_SIZE]
    return data


# ============================================================================
# Shearwater BLE Transport
# ============================================================================

class ShearwaterBLE:
    def __init__(self):
        self.client = None
        self.rx_buffer = bytearray()
        self.rx_event = asyncio.Event()
        self.rx_complete = False

    def _notification_handler(self, sender, data: bytearray):
        """Handle incoming BLE notifications."""
        if len(data) < 2:
            return

        # Strip 2-byte BLE header, append to buffer
        payload = data[2:]
        self.rx_buffer.extend(payload)

        # Check if we received a complete SLIP frame (contains END byte)
        if END in payload:
            self.rx_complete = True
            self.rx_event.set()

    async def connect(self, timeout=30):
        """Scan for and connect to Peregrine TX."""
        print("\n[BLE] Peregrine TX 스캔 중...")

        device = await BleakScanner.find_device_by_filter(
            lambda d, adv: d.name is not None and "Peregrine" in d.name,
            timeout=timeout,
        )

        if device is None:
            raise ConnectionError(
                "Peregrine TX를 찾을 수 없습니다.\n"
                "다이브 컴퓨터가 Bluetooth 모드인지 확인하세요."
            )

        print(f"[BLE] 발견: {device.name} ({device.address})")
        print(f"[BLE] 연결 중...")

        self.client = BleakClient(device, timeout=15)
        await self.client.connect()

        print(f"[BLE] 연결 성공!")

        # Enumerate services for debugging
        print(f"[BLE] 서비스 열거 중...")
        for service in self.client.services:
            print(f"  서비스: {service.uuid}")
            for char in service.characteristics:
                props = ", ".join(char.properties)
                print(f"    특성: {char.uuid} [{props}] (handle: 0x{char.handle:04X})")

        # Brief pause before starting notifications
        await asyncio.sleep(0.5)

        # Find the correct characteristic
        target_char = None
        for service in self.client.services:
            if SERVICE_UUID.lower() in service.uuid.lower():
                for char in service.characteristics:
                    if CHAR_UUID.lower() in char.uuid.lower():
                        target_char = char
                        break

        if target_char is None:
            # Fallback: find any characteristic with notify property
            for service in self.client.services:
                for char in service.characteristics:
                    if "notify" in char.properties:
                        target_char = char
                        print(f"[BLE] 폴백 특성 사용: {char.uuid}")
                        break

        if target_char is None:
            raise ConnectionError("Notify 가능한 특성을 찾을 수 없습니다.")

        self.char_uuid = target_char.uuid

        # Start notifications with retry
        for attempt in range(3):
            try:
                await self.client.start_notify(self.char_uuid, self._notification_handler)
                print(f"[BLE] Notification 시작 성공")
                break
            except Exception as e:
                print(f"[BLE] Notification 시작 실패 (시도 {attempt+1}/3): {e}")
                if attempt < 2:
                    await asyncio.sleep(1)
                else:
                    raise

        # Brief pause like libdivecomputer does
        await asyncio.sleep(0.3)

    async def send(self, payload: bytes):
        """Send a request packet via BLE."""
        packet = build_request(payload)
        frames = slip_encode_ble(packet)

        for frame in frames:
            await self.client.write_gatt_char(self.char_uuid, frame, response=False)

    async def receive(self, timeout=5.0) -> bytes:
        """Receive a response packet from BLE notifications."""
        self.rx_buffer.clear()
        self.rx_complete = False
        self.rx_event.clear()

        try:
            await asyncio.wait_for(self._wait_for_response(), timeout=timeout)
        except asyncio.TimeoutError:
            raise TimeoutError("응답 타임아웃")

        decoded = slip_decode(self.rx_buffer)
        return parse_response(decoded)

    async def _wait_for_response(self):
        while not self.rx_complete:
            self.rx_event.clear()
            await self.rx_event.wait()

    async def transfer(self, payload: bytes, expect_response=True, timeout=5.0) -> bytes:
        """Send request and receive response."""
        await self.send(payload)

        if not expect_response:
            return b''

        return await self.receive(timeout=timeout)

    async def rdbi(self, data_id: int) -> bytes:
        """Read Data By Identifier."""
        request = bytes([RDBI_REQUEST, (data_id >> 8) & 0xFF, data_id & 0xFF])
        response = await self.transfer(request)

        if len(response) < 3:
            raise ProtocolError(f"RDBI response too short: {len(response)}")

        if response[0] == NAK:
            raise ProtocolError(f"NAK received for RDBI 0x{data_id:04X}, error: 0x{response[2]:02X}")

        if response[0] != RDBI_RESPONSE:
            raise ProtocolError(f"Unexpected RDBI response: 0x{response[0]:02X}")

        resp_id = (response[1] << 8) | response[2]
        if resp_id != data_id:
            raise ProtocolError(f"RDBI ID mismatch: expected 0x{data_id:04X}, got 0x{resp_id:04X}")

        return response[3:]

    async def wdbi(self, data_id: int, data: bytes, expect_response=True):
        """Write Data By Identifier."""
        request = bytes([WDBI_REQUEST, (data_id >> 8) & 0xFF, data_id & 0xFF]) + data
        await self.transfer(request, expect_response=expect_response)

    async def download(self, address: int, size: int, compression: bool,
                       progress_label="") -> bytes:
        """Download data from the dive computer."""
        # Init request
        req_init = bytes([
            DL_INIT,
            0x10 if compression else 0x00,
            0x34,
            (address >> 24) & 0xFF,
            (address >> 16) & 0xFF,
            (address >> 8) & 0xFF,
            address & 0xFF,
            (size >> 16) & 0xFF,
            (size >> 8) & 0xFF,
            size & 0xFF,
        ])

        response = await self.transfer(req_init, timeout=10.0)

        if len(response) < 3 or response[0] != DL_INIT_RESP:
            raise ProtocolError(f"Unexpected init response: {response.hex()}")

        if progress_label:
            print(f"  [{progress_label}] 다운로드 시작...")

        # Download blocks
        buffer = bytearray()
        block = 1
        nbytes = 0
        done = False

        while nbytes < size and not done:
            req_block = bytes([DL_BLOCK, block & 0xFF])
            response = await self.transfer(req_block, timeout=15.0)

            if len(response) < 2 or response[0] != DL_BLOCK_RESP:
                raise ProtocolError(f"Unexpected block response: {response[:4].hex()}")

            if response[1] != (block & 0xFF):
                raise ProtocolError(
                    f"Block number mismatch: expected {block & 0xFF}, got {response[1]}")

            block_data = response[2:]
            length = len(block_data)

            if compression:
                done = decompress_lre(block_data, buffer)
            else:
                buffer.extend(block_data)

            nbytes += length
            block += 1

            # Progress
            if block % 20 == 0 and progress_label:
                if compression:
                    print(f"  [{progress_label}] {len(buffer)} bytes 수신 중... (블록 {block})")
                else:
                    print(f"  [{progress_label}] {nbytes}/{size} bytes")

        # XOR decompression
        if compression and len(buffer) > 0:
            buffer = decompress_xor(buffer)

        # Quit
        req_quit = bytes([DL_QUIT])
        response = await self.transfer(req_quit, timeout=10.0)

        if len(response) < 2 or response[0] != DL_QUIT_RESP or response[1] != 0x00:
            print(f"  [경고] Quit 응답이 예상과 다릅니다: {response.hex()}")

        if progress_label:
            print(f"  [{progress_label}] 완료: {len(buffer)} bytes")

        return bytes(buffer)

    async def close(self):
        """Send close command and disconnect."""
        try:
            # Send close command (WDBI 0x9020 with 0x00, no response expected)
            await self.wdbi(0x9020, bytes([0x00]), expect_response=False)
            await asyncio.sleep(0.2)
        except Exception:
            pass

        try:
            await self.client.stop_notify(self.char_uuid)
        except Exception:
            pass

        try:
            await self.client.disconnect()
        except Exception:
            pass

        print("[BLE] 연결 종료")


# ============================================================================
# Manifest Parsing
# ============================================================================

def parse_manifest(data: bytes) -> list:
    """Parse manifest data into dive records."""
    dives = []
    offset = 0

    while offset + RECORD_SIZE <= len(data):
        header = struct.unpack_from('>H', data, offset)[0]

        if header == HEADER_DELETED:
            offset += RECORD_SIZE
            continue
        if header != HEADER_VALID:
            break

        fingerprint = data[offset + 4:offset + 8]
        dive_addr = struct.unpack_from('>I', data, offset + 20)[0]

        # Dive number from fingerprint (big-endian uint32)
        dive_num = struct.unpack('>I', fingerprint)[0]

        dives.append({
            'number': dive_num,
            'fingerprint': fingerprint,
            'address': dive_addr,
            'raw_record': data[offset:offset + RECORD_SIZE],
        })

        offset += RECORD_SIZE

    return dives


# ============================================================================
# Main
# ============================================================================

async def main():
    parser = argparse.ArgumentParser(description='Shearwater Peregrine TX 다이브 데이터 다운로더')
    parser.add_argument('--all', action='store_true', help='모든 다이브 다운로드 (기본: 최신 1개)')
    parser.add_argument('--output', '-o', default=os.path.join('..', 'data', 'raw'),
                        help='출력 디렉토리 (기본: logbook/data/raw)')
    parser.add_argument('--timeout', '-t', type=int, default=30, help='BLE 스캔 타임아웃 초 (기본: 30)')
    args = parser.parse_args()

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.output)
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("  Shearwater Peregrine TX 다이브 데이터 다운로더")
    print("=" * 60)
    print()
    print("  [Peregrine TX 블루투스 모드 진입 방법]")
    print("  1. Peregrine TX 전원을 켭니다")
    print("  2. LEFT 버튼을 반복 눌러 'Bluetooth' 옵션으로 이동합니다")
    print("  3. RIGHT 버튼을 눌러 Bluetooth를 선택합니다")
    print("  4. 'PC 대기' 화면이 나타나면 연결 준비 완료입니다")
    print()
    print("  TIP: 'PC 대기' 모드는 일정 시간 후 자동 종료됩니다.")
    print("       이 스크립트가 스캔 중일 때 다이브 컴퓨터에서")
    print("       Bluetooth를 활성화하세요.")
    print()
    print("  주의: Windows 설정에서 Peregrine TX가 '페어링된 장치'로")
    print("       등록되어 있다면, 제거 후 다시 시도하세요.")
    print("       (클래식 BT 페어링이 BLE 연결을 방해할 수 있습니다)")
    print("=" * 60)

    device = ShearwaterBLE()

    try:
        # Connect
        await device.connect(timeout=args.timeout)
        print()

        # Read device info
        print("[INFO] 장치 정보 읽기...")

        serial_data = await device.rdbi(ID_SERIAL)
        serial_str = serial_data.hex().upper()
        print(f"  시리얼 번호: {serial_str}")

        firmware_data = await device.rdbi(ID_FIRMWARE)
        firmware_str = firmware_data.rstrip(b'\x00').decode('ascii', errors='replace')
        print(f"  펌웨어 버전: {firmware_str}")

        hardware_data = await device.rdbi(ID_HARDWARE)
        hardware = struct.unpack('>H', hardware_data[:2])[0]
        print(f"  하드웨어 타입: 0x{hardware:04X}")

        logupload_data = await device.rdbi(ID_LOGUPLOAD)
        print(f"  로그업로드 정보: {logupload_data.hex()}")

        # Determine base address
        base_addr = struct.unpack('>I', logupload_data[1:5])[0]
        if base_addr in (0xDD000000, 0xC0000000, 0x90000000):
            base_addr = 0xC0000000
        elif base_addr == 0x80000000:
            pass  # correct
        else:
            print(f"  [경고] 알 수 없는 로그북 포맷: 0x{base_addr:08X}")
            print(f"  계속 진행합니다 (0x80000000 사용)...")
            base_addr = 0x80000000

        print(f"  기본 주소: 0x{base_addr:08X}")

        # Save device info
        info_path = os.path.join(output_dir, 'device_info.txt')
        with open(info_path, 'w', encoding='utf-8') as f:
            f.write(f"Date: {datetime.now().isoformat()}\n")
            f.write(f"Serial: {serial_str}\n")
            f.write(f"Firmware: {firmware_str}\n")
            f.write(f"Hardware: 0x{hardware:04X}\n")
            f.write(f"Logupload: {logupload_data.hex()}\n")
            f.write(f"Base Address: 0x{base_addr:08X}\n")
        print(f"\n  장치 정보 저장: {info_path}")
        print()

        # Download manifest
        print("[MANIFEST] 매니페스트 다운로드 중...")
        manifest_data = await device.download(
            MANIFEST_ADDR, MANIFEST_SIZE,
            compression=False,
            progress_label="MANIFEST"
        )

        manifest_path = os.path.join(output_dir, 'manifest.bin')
        with open(manifest_path, 'wb') as f:
            f.write(manifest_data)
        print(f"  매니페스트 저장: {manifest_path} ({len(manifest_data)} bytes)")
        print()

        # Parse manifest
        dives = parse_manifest(manifest_data)
        print(f"[DIVES] 발견된 다이브: {len(dives)}개")

        if not dives:
            print("  다이브 데이터가 없습니다.")
            await device.close()
            return

        for i, d in enumerate(dives):
            print(f"  #{i+1}: 다이브 번호 {d['number']}, 주소 0x{d['address']:08X}")

        print()

        # Download dives
        dives_to_download = dives if args.all else dives[:1]
        total = len(dives_to_download)

        for i, dive in enumerate(dives_to_download):
            label = f"DIVE {i+1}/{total}"
            print(f"[{label}] 다이브 #{dive['number']} 다운로드 중...")

            addr = base_addr + dive['address']
            dive_data = await device.download(
                addr, DIVE_SIZE,
                compression=True,
                progress_label=label
            )

            dive_path = os.path.join(output_dir, f"dive_{dive['number']:04d}.bin")
            with open(dive_path, 'wb') as f:
                f.write(dive_data)
            print(f"  저장: {dive_path} ({len(dive_data)} bytes)")

            # Also save raw fingerprint
            fp_path = os.path.join(output_dir, f"dive_{dive['number']:04d}_fingerprint.bin")
            with open(fp_path, 'wb') as f:
                f.write(dive['fingerprint'])

            print()

        print("=" * 60)
        print(f"  완료! {total}개 다이브 다운로드됨")
        print(f"  출력 디렉토리: {output_dir}")
        print("=" * 60)

    except ConnectionError as e:
        print(f"\n[오류] 연결 실패: {e}")
        sys.exit(1)
    except TimeoutError as e:
        print(f"\n[오류] 타임아웃: {e}")
        print("  다이브 컴퓨터가 아직 Bluetooth 모드인지 확인하세요.")
        print("  'PC 대기' 모드가 종료되었을 수 있습니다.")
        sys.exit(1)
    except ProtocolError as e:
        print(f"\n[오류] 프로토콜 오류: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n[오류] 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if device.client and device.client.is_connected:
            await device.close()


if __name__ == '__main__':
    asyncio.run(main())
