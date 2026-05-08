import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Bluetooth,
  Cpu,
  Hash,
  CheckCircle2,
  Circle,
  Download,
  AlertCircle,
} from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import { encode as b64Encode } from "base64-arraybuffer";

import {
  ShearwaterClient,
  type DeviceInfo,
  type ManifestEntry,
  type ParsedDive,
  parsePNF,
  requestBlePermissions,
} from "@/src/services/ble";
import { useImportPnfDives } from "@/src/hooks/use-dives";
import { useAuthStore } from "@/src/store/auth-store";
import { friendlyError } from "@/src/lib/error-messages";

type Phase =
  | "idle"
  | "permission"
  | "scanning"
  | "connecting"
  | "reading"
  | "manifest"
  | "ready"
  | "downloading"
  | "saving"
  | "done"
  | "error";

type ProgressMap = Record<number, { bytes: number; block: number }>;

type SavedDive = {
  diveNumber: number;
  uri: string;
  byteSize: number;
  parsed?: ParsedDive;
};

const phaseLabel: Record<Phase, string> = {
  idle: "대기",
  permission: "권한 요청 중",
  scanning: "Peregrine 스캔 중",
  connecting: "연결 중",
  reading: "장치 정보 읽는 중",
  manifest: "매니페스트 다운로드 중",
  ready: "다이브 선택",
  downloading: "다이브 다운로드 중",
  saving: "Supabase에 저장 중",
  done: "완료",
  error: "오류",
};

export default function ImportScreen() {
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id);
  const clientRef = useRef<ShearwaterClient | null>(null);
  const importMut = useImportPnfDives(userId);

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<ProgressMap>({});
  const [saved, setSaved] = useState<SavedDive[]>([]);
  const [importResult, setImportResult] = useState<{
    inserted: number;
    skipped: number;
    skippedNumbers: number[];
  } | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup: close client on unmount.
      const c = clientRef.current;
      if (c) {
        c.close().catch(() => {});
        c.destroy();
        clientRef.current = null;
      }
    };
  }, []);

  const handleStart = async () => {
    setError(null);
    setSaved([]);
    setManifest([]);
    setDeviceInfo(null);
    setSelected(new Set());

    setPhase("permission");
    const granted = await requestBlePermissions();
    if (!granted) {
      setError("Bluetooth 권한이 필요합니다.");
      setPhase("error");
      return;
    }

    const client = new ShearwaterClient();
    clientRef.current = client;

    try {
      setPhase("scanning");
      const device = await client.scan(45_000);

      setPhase("connecting");
      await client.connect(device);

      setPhase("reading");
      const info = await client.readDeviceInfo();
      setDeviceInfo(info);

      setPhase("manifest");
      const entries = await client.downloadManifest();
      setManifest(entries);
      setSelected(new Set(entries.map((e) => e.diveNumber)));

      setPhase("ready");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("error");
      try {
        await client.close();
      } catch {}
      client.destroy();
      clientRef.current = null;
    }
  };

  const toggleSelect = (n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  };

  const handleDownload = async () => {
    const client = clientRef.current;
    if (!client || !deviceInfo) return;
    const targets = manifest.filter((e) => selected.has(e.diveNumber));
    if (targets.length === 0) return;

    setPhase("downloading");
    const out: SavedDive[] = [];
    const dir = `${FileSystem.cacheDirectory}dive_bin/`;
    try {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    } catch {
      /* may already exist */
    }

    try {
      for (const entry of targets) {
        const data = await client.downloadDive(
          entry,
          deviceInfo.baseAddress,
          (p) =>
            setProgress((prev) => ({
              ...prev,
              [entry.diveNumber]: { bytes: p.bytesReceived, block: p.block },
            })),
        );
        const filename = `dive_${String(entry.diveNumber).padStart(4, "0")}.bin`;
        const uri = dir + filename;
        const buf = new ArrayBuffer(data.length);
        new Uint8Array(buf).set(data);
        await FileSystem.writeAsStringAsync(uri, b64Encode(buf), {
          encoding: FileSystem.EncodingType.Base64,
        });

        let parsed: ParsedDive | undefined;
        try {
          parsed = parsePNF(data);
        } catch {
          // Parse error is non-fatal — keep the .bin so user can retry.
        }
        out.push({
          diveNumber: entry.diveNumber,
          uri,
          byteSize: data.length,
          parsed,
        });
        setSaved([...out]);
      }

      // Insert parsed dives into Supabase
      const importable = out.filter(
        (d): d is SavedDive & { parsed: ParsedDive } => !!d.parsed,
      );
      if (importable.length > 0) {
        setPhase("saving");
        const result = await importMut.mutateAsync(
          importable.map((d) => ({
            parsed: d.parsed,
            diveNumber: d.diveNumber,
          })),
        );
        setImportResult(result);
      }
      setPhase("done");
    } catch (e) {
      setError(friendlyError(e));
      setPhase("error");
    } finally {
      try {
        await client.close();
      } catch {}
    }
  };

  const handleClose = async () => {
    const c = clientRef.current;
    if (c) {
      try {
        await c.close();
      } catch {}
      c.destroy();
      clientRef.current = null;
    }
    router.back();
  };

  const isBusy =
    phase !== "idle" &&
    phase !== "ready" &&
    phase !== "done" &&
    phase !== "error";

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-gray-50">
      <View className="flex-row justify-between items-center px-5 pt-2 pb-3">
        <Pressable
          onPress={handleClose}
          className="w-10 h-10 bg-white rounded-full items-center justify-center border border-gray-100"
        >
          <ChevronLeft size={22} color="#374151" />
        </Pressable>
        <Text className="text-base font-black text-gray-900">
          Shearwater 가져오기
        </Text>
        <View className="w-10" />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
          <Text className="text-[10px] font-black text-gray-400 uppercase mb-2">
            Status
          </Text>
          <View className="flex-row items-center gap-2">
            {isBusy ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : phase === "error" ? (
              <AlertCircle size={16} color="#DC2626" />
            ) : phase === "done" ? (
              <CheckCircle2 size={16} color="#059669" />
            ) : (
              <Bluetooth size={16} color="#2563EB" />
            )}
            <Text className="text-sm font-black text-gray-900">
              {phaseLabel[phase]}
            </Text>
          </View>
          {error ? (
            <Text className="text-xs text-red-600 mt-2">{error}</Text>
          ) : null}
        </View>

        {phase === "idle" || phase === "error" ? (
          <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
            <Text className="text-xs text-gray-600 leading-5 mb-4">
              Peregrine TX 전원을 켜고{" "}
              <Text className="font-black">Bluetooth → PC 대기</Text>로 진입한 뒤
              아래 버튼을 누르세요. 'PC 대기'는 빠르게 타임아웃되니 스캔이 시작된 후
              활성화하는 것이 안정적입니다.
            </Text>
            <Pressable
              onPress={handleStart}
              className="bg-brand-600 p-4 rounded-2xl items-center active:scale-95"
            >
              <Text className="text-white font-black">스캔 시작</Text>
            </Pressable>
          </View>
        ) : null}

        {deviceInfo ? (
          <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
            <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
              Device
            </Text>
            <InfoRow icon={<Hash size={14} color="#6B7280" />} label="시리얼" value={deviceInfo.serial} />
            <InfoRow icon={<Cpu size={14} color="#6B7280" />} label="펌웨어" value={deviceInfo.firmware} />
            <InfoRow
              icon={<Cpu size={14} color="#6B7280" />}
              label="하드웨어"
              value={`0x${deviceInfo.hardware.toString(16).toUpperCase()}`}
            />
          </View>
        ) : null}

        {manifest.length > 0 ? (
          <View className="bg-white p-5 rounded-3xl border border-gray-100 mb-4">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase">
                Manifest ({manifest.length})
              </Text>
              <Pressable
                onPress={() =>
                  setSelected(
                    selected.size === manifest.length
                      ? new Set()
                      : new Set(manifest.map((e) => e.diveNumber)),
                  )
                }
                disabled={phase === "downloading"}
              >
                <Text className="text-xs font-black text-brand-600">
                  {selected.size === manifest.length ? "전체 해제" : "전체 선택"}
                </Text>
              </Pressable>
            </View>
            <View className="gap-2">
              {manifest.map((entry) => {
                const isSel = selected.has(entry.diveNumber);
                const prog = progress[entry.diveNumber];
                const savedEntry = saved.find(
                  (s) => s.diveNumber === entry.diveNumber,
                );
                return (
                  <Pressable
                    key={entry.diveNumber}
                    onPress={() => toggleSelect(entry.diveNumber)}
                    disabled={phase === "downloading" || phase === "done"}
                    className="flex-row items-center gap-3 p-3 bg-gray-50 rounded-2xl"
                  >
                    {savedEntry ? (
                      <CheckCircle2 size={18} color="#059669" />
                    ) : isSel ? (
                      <CheckCircle2 size={18} color="#2563EB" />
                    ) : (
                      <Circle size={18} color="#9CA3AF" />
                    )}
                    <View className="flex-1">
                      <Text className="text-sm font-black text-gray-900">
                        DIVE #{entry.diveNumber}
                      </Text>
                      <Text className="text-[10px] text-gray-500 font-bold">
                        addr 0x{entry.address.toString(16)}
                      </Text>
                    </View>
                    {savedEntry ? (
                      <Text className="text-[10px] text-emerald-700 font-black">
                        {(savedEntry.byteSize / 1024).toFixed(1)} KB
                      </Text>
                    ) : prog ? (
                      <Text className="text-[10px] text-brand-700 font-black">
                        block {prog.block}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {phase === "ready" ? (
          <Pressable
            onPress={handleDownload}
            disabled={selected.size === 0}
            className={`p-4 rounded-2xl items-center flex-row justify-center gap-2 ${
              selected.size === 0 ? "bg-gray-200" : "bg-brand-600 active:scale-95"
            }`}
          >
            <Download size={16} color="#fff" />
            <Text className="text-white font-black">
              {selected.size}개 다운로드
            </Text>
          </Pressable>
        ) : null}

        {phase === "done" && saved.length > 0 ? (
          <View className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
            <Text className="text-xs font-black text-emerald-700 mb-2">
              {importResult
                ? `완료 — 새 다이브 ${importResult.inserted}개 추가${
                    importResult.skipped > 0
                      ? `, 중복 ${importResult.skipped}개 건너뜀`
                      : ""
                  }`
                : `완료 — ${saved.length}개 다운로드됨`}
            </Text>
            <Text className="text-[11px] text-emerald-800/80 leading-5">
              로그북에서 각 다이브의 위치/메모를 채워주세요. 깊이·시간·가스·프로파일은
              자동으로 채워졌어요.
            </Text>
            {importResult?.skippedNumbers.length ? (
              <Text className="text-[10px] text-emerald-700/70 mt-2">
                건너뜀: #{importResult.skippedNumbers.join(", #")}
              </Text>
            ) : null}
            <Pressable
              onPress={() => router.replace("/(tabs)/logbook")}
              className="bg-emerald-600 mt-4 p-3 rounded-2xl items-center"
            >
              <Text className="text-white font-black text-xs">로그북으로 이동</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 mb-2">
      {icon}
      <Text className="text-[10px] font-black text-gray-400 uppercase w-16">
        {label}
      </Text>
      <Text className="text-xs text-gray-900 font-bold flex-1" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
