import { Platform, PermissionsAndroid } from "react-native";

// Android 12 (API 31) split BLUETOOTH into BLUETOOTH_SCAN/CONNECT (no
// location needed); pre-31 still requires ACCESS_FINE_LOCATION for scanning.
// iOS handles Bluetooth via Info.plist; nothing to request at runtime.
export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const apiLevel = Number(Platform.Version) || 0;
  const perms: string[] =
    apiLevel >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];

  const result = await PermissionsAndroid.requestMultiple(perms as never);
  return perms.every(
    (p) => result[p as never] === PermissionsAndroid.RESULTS.GRANTED,
  );
}
