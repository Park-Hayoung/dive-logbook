"""Quick BLE scan to see all nearby devices."""
import asyncio
from bleak import BleakScanner

async def main():
    print("BLE 장치 스캔 중... (15초)")
    print("지금 Peregrine TX에서 Bluetooth를 활성화하세요!")
    print("-" * 60)

    devices = await BleakScanner.discover(timeout=15, return_adv=True)

    if not devices:
        print("BLE 장치를 찾을 수 없습니다.")
        return

    for addr, (device, adv) in devices.items():
        name = device.name or "(이름 없음)"
        rssi = adv.rssi
        uuids = ", ".join(adv.service_uuids) if adv.service_uuids else "없음"
        print(f"  {name:30s}  {addr}  RSSI: {rssi}  UUIDs: {uuids}")

asyncio.run(main())
