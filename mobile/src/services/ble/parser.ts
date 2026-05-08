// Petrel Native Format (PNF) parser.
// Ported from logbook/parser/parse_dive_logs.py — opening records 0..6 + 9,
// sample loop, closing record 0, final record, computed aggregates.
//
// Records are 32 bytes; the first byte is the record type:
//   0x10..0x19 → opening record N
//   0x20..0x29 → closing record N
//   0x01       → sample
//   0xFF       → final
//   0x30       → info event (ignored here)

const PSI = 6894.75729;
const BAR = 100000.0;
const FEET = 0.3048;
const RECORD_SIZE = 32;

export const DIVE_MODES: Record<number, string> = {
  0: "CC",
  1: "OC Tec",
  2: "Gauge",
  3: "PPO2",
  4: "SC",
  5: "CC2",
  6: "OC Rec",
  7: "Freedive",
  12: "Avelo",
};

export const DECO_MODELS: Record<number, string> = {
  0: "Bühlmann GF",
  1: "VPM-B",
  2: "VPM-B+GFS",
  3: "DCIEM",
};

export type ParsedSample = {
  timeS: number;
  depthM: number;
  tempC: number;
  o2Pct: number;
  hePct: number;
  decoType: "NDL" | "DECO";
  decoStopM: number;
  ndlDecoMin: number;
  ttsMin: number;
  cns: number;
  tank0Bar: number | null;
  tank1Bar: number | null;
  rbtMin: number | null;
};

export type ParsedGasMix = {
  index: number;
  o2: number;
  he: number;
  n2: number;
  enabled: boolean;
  diluent: boolean;
};

export type ParsedTank = {
  id: number;
  serial: number;
  maxPressureBar: number;
  reserveBar: number;
  enabled?: boolean;
  name?: string;
};

export type ParsedDive = {
  units: "metric" | "imperial";
  timestamp: number; // Unix seconds (UTC)
  datetimeUtc: string; // ISO-ish "YYYY-MM-DD HH:MM:SS"
  gfLow: number;
  gfHigh: number;
  atmosphericMbar: number;
  decoModel: string;
  vpmbConservatism?: number;
  waterDensity: number;
  waterType: "fresh" | "salt";
  diveMode: string;
  logVersion: number;
  aiMode: number;
  sampleIntervalMs: number;
  utcOffsetSec?: number;
  dst?: number;
  latitude?: number;
  longitude?: number;
  gasMixes: ParsedGasMix[];
  tanks: ParsedTank[];
  samples: ParsedSample[];
  // closing
  maxDepthM?: number;
  durationS?: number;
  // final
  deviceSerial?: number;
  deviceModel?: number;
  // computed
  avgDepthM?: number;
  minTempC?: number;
  maxTempC?: number;
  startPressureBar?: number;
  endPressureBar?: number;
  gasUsedBar?: number;
  consumptionBarPerMin?: number;
  minNdlMin?: number | null;
  maxCns?: number;
};

export class PnfParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PnfParseError";
  }
}

// ============================================================================
// Byte helpers (big-endian)
// ============================================================================
function u16(d: Uint8Array, o: number): number {
  return (d[o] << 8) | d[o + 1];
}
function i16(d: Uint8Array, o: number): number {
  const v = u16(d, o);
  return v >= 0x8000 ? v - 0x10000 : v;
}
function u24(d: Uint8Array, o: number): number {
  return (d[o] << 16) | (d[o + 1] << 8) | d[o + 2];
}
function u32(d: Uint8Array, o: number): number {
  return (
    ((d[o] << 24) >>> 0) +
    (d[o + 1] << 16) +
    (d[o + 2] << 8) +
    d[o + 3]
  );
}
function i32(d: Uint8Array, o: number): number {
  const v = u32(d, o);
  return v >= 0x80000000 ? v - 0x100000000 : v;
}
function bcd(d: Uint8Array, start: number, len: number): number {
  let result = 0;
  for (let i = 0; i < len; i++) {
    const b = d[start + i];
    result = result * 100 + (b >> 4) * 10 + (b & 0x0f);
  }
  return result;
}
function ascii(d: Uint8Array, start: number, len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    const c = d[start + i];
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.replace(/^\s+|\s+$/g, "");
}

function decodeTankPressure(raw: number): {
  bar: number | null;
  battery: number | null;
} {
  if (raw >= 0xfff0) return { bar: null, battery: null };
  const pressure2psi = raw & 0x0fff;
  const battery = (raw >> 12) & 0x0f;
  if (pressure2psi === 0) return { bar: null, battery };
  const bar = (pressure2psi * 2 * PSI) / BAR;
  return { bar: Math.round(bar * 10) / 10, battery };
}

function fmtUtc(ts: number): string {
  const d = new Date(ts * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

// ============================================================================
// Main parser
// ============================================================================
export function parsePNF(data: Uint8Array): ParsedDive {
  const size = data.length;
  if (size < 64) {
    throw new PnfParseError(`PNF too small: ${size} bytes`);
  }

  const opening: Record<number, number> = {};
  const closing: Record<number, number> = {};
  let finalOff: number | null = null;
  const sampleOffsets: number[] = [];

  for (let i = 0; i + RECORD_SIZE <= size; i += RECORD_SIZE) {
    const t = data[i];
    if (t >= 0x10 && t <= 0x19) opening[t - 0x10] = i;
    else if (t >= 0x20 && t <= 0x29) closing[t - 0x20] = i;
    else if (t === 0xff) finalOff = i;
    else if (t === 0x01) sampleOffsets.push(i);
    // 0x30 info events ignored
  }

  for (let r = 0; r < 5; r++) {
    if (!(r in opening)) {
      throw new PnfParseError(`Missing opening record ${r}`);
    }
  }

  // ---- rec0 ----
  const r0 = data.subarray(opening[0], opening[0] + RECORD_SIZE);
  const gfLow = r0[4];
  const gfHigh = r0[5];
  const unitsByte = r0[8];
  const units: "metric" | "imperial" = unitsByte === 1 ? "imperial" : "metric";
  const timestamp = u32(r0, 12);
  const gasO2 = Array.from(r0.subarray(20, 30));
  const gasHe = Array.from(r0.subarray(30, 32));

  // ---- rec1 ----
  const r1 = data.subarray(opening[1], opening[1] + RECORD_SIZE);
  for (let i = 1; i < 9; i++) gasHe.push(r1[i]);
  const atmosphericMbar = u16(r1, 16);

  // ---- rec2 ----
  const r2 = data.subarray(opening[2], opening[2] + RECORD_SIZE);
  const decoModelId = r2[18];
  const decoModel = DECO_MODELS[decoModelId] ?? `Unknown(${decoModelId})`;
  const vpmbConservatism =
    decoModelId === 1 || decoModelId === 2 ? r2[19] : undefined;

  // ---- rec3 ----
  const r3 = data.subarray(opening[3], opening[3] + RECORD_SIZE);
  const waterDensity = u16(r3, 3);
  const waterType: "fresh" | "salt" =
    waterDensity === 1000 ? "fresh" : "salt";

  // ---- rec4 ----
  const r4 = data.subarray(opening[4], opening[4] + RECORD_SIZE);
  const diveModeId = r4[1];
  const diveMode = DIVE_MODES[diveModeId] ?? `Unknown(${diveModeId})`;
  const logVersion = r4[16];
  const gasEnabledBits = u16(r4, 17);
  const aiMode = r4[28];

  const gasMixes: ParsedGasMix[] = [];
  for (let i = 0; i < 10; i++) {
    if (gasO2[i] === 0 && gasHe[i] === 0) continue;
    const enabled = (gasEnabledBits & (1 << i)) !== 0;
    if (!enabled) continue;
    gasMixes.push({
      index: i,
      o2: gasO2[i],
      he: gasHe[i],
      n2: 100 - gasO2[i] - gasHe[i],
      enabled: true,
      diluent: i >= 5,
    });
  }

  // ---- rec5 (optional, log_version >= 9) ----
  let sampleIntervalMs = 10000;
  let utcOffsetSec: number | undefined;
  let dst: number | undefined;
  const tanks: ParsedTank[] = [];
  if (5 in opening && logVersion >= 9) {
    const r5 = data.subarray(opening[5], opening[5] + RECORD_SIZE);
    sampleIntervalMs = u16(r5, 23);
    utcOffsetSec = i32(r5, 26);
    dst = r5[30];
    tanks.push({
      id: 0,
      serial: bcd(r5, 1, 3),
      maxPressureBar: Math.round(u16(r5, 6) / 10) / 10,
      reserveBar: Math.round(u16(r5, 8) / 10) / 10,
    });
    tanks.push({
      id: 1,
      serial: bcd(r5, 10, 3),
      maxPressureBar: Math.round(u16(r5, 15) / 10) / 10,
      reserveBar: Math.round(u16(r5, 17) / 10) / 10,
    });
  }

  // ---- rec6 (optional, log_version >= 13) ----
  if (6 in opening && logVersion >= 13 && tanks.length >= 2) {
    const r6 = data.subarray(opening[6], opening[6] + RECORD_SIZE);
    tanks[0].enabled = !!r6[19];
    tanks[0].name = ascii(r6, 20, 2);
    tanks[1].enabled = !!r6[22];
    tanks[1].name = ascii(r6, 23, 2);
  }

  // ---- rec9 (optional, AI_ON_GPS) ----
  let latitude: number | undefined;
  let longitude: number | undefined;
  if (9 in opening && aiMode === 6) {
    const r9 = data.subarray(opening[9], opening[9] + RECORD_SIZE);
    const latRaw = i32(r9, 21);
    const lonRaw = i32(r9, 25);
    if (!(latRaw === 0 && lonRaw === 0) && !(latRaw === -1 && lonRaw === -1)) {
      latitude = Math.round(latRaw / 100000.0 * 100000) / 100000;
      longitude = Math.round(lonRaw / 100000.0 * 100000) / 100000;
    }
  }

  // ---- samples ----
  const samples: ParsedSample[] = [];
  let timeMs = 0;
  for (const off of sampleOffsets) {
    const rec = data.subarray(off, off + RECORD_SIZE);
    timeMs += sampleIntervalMs;
    const timeS = timeMs / 1000.0;

    const depthRaw = u16(rec, 1);
    const depthM =
      units === "imperial"
        ? Math.round((depthRaw / 10.0) * FEET * 100) / 100
        : Math.round((depthRaw / 10.0) * 10) / 10;

    const decoStopRaw = u16(rec, 3);
    const decoType: "NDL" | "DECO" = decoStopRaw > 0 ? "DECO" : "NDL";
    const decoStopM =
      decoStopRaw > 0
        ? units === "imperial"
          ? Math.round(decoStopRaw * FEET * 10) / 10
          : decoStopRaw
        : 0;

    const ttsMin = u16(rec, 5);
    const o2Pct = rec[8];
    const hePct = rec[9];
    const ndlDecoMin = rec[10];

    // Temperature: signed byte, with special encoding for negatives
    const tempRaw = rec[14];
    let tempSigned = tempRaw < 128 ? tempRaw : tempRaw - 256;
    if (tempSigned < 0) {
      tempSigned += 102;
      if (tempSigned > 0) tempSigned = 0;
    }
    const tempC =
      units === "imperial"
        ? Math.round(((tempSigned - 32.0) * 5.0) / 9.0 * 10) / 10
        : tempSigned;

    const tp0 = decodeTankPressure(u16(rec, 28));
    const tp1 = decodeTankPressure(u16(rec, 20));

    const rbtRaw = rec[22];
    const rbtMin = rbtRaw < 0xf0 ? rbtRaw : null;

    const cns = Math.round((rec[23] / 100.0) * 100) / 100;

    samples.push({
      timeS,
      depthM,
      tempC,
      o2Pct,
      hePct,
      decoType,
      decoStopM,
      ndlDecoMin,
      ttsMin,
      cns,
      tank0Bar: tp0.bar,
      tank1Bar: tp1.bar,
      rbtMin,
    });
  }

  // ---- closing rec_c0 ----
  let maxDepthM: number | undefined;
  let durationS: number | undefined;
  if (0 in closing) {
    const rc = data.subarray(closing[0], closing[0] + RECORD_SIZE);
    const maxDepthRaw = u16(rc, 4);
    maxDepthM =
      units === "imperial"
        ? Math.round((maxDepthRaw / 10.0) * FEET * 10) / 10
        : Math.round((maxDepthRaw / 10.0) * 10) / 10;
    durationS = u24(rc, 6);
  }

  // ---- final 0xFF ----
  let deviceSerial: number | undefined;
  let deviceModel: number | undefined;
  if (finalOff !== null) {
    const rf = data.subarray(finalOff, finalOff + RECORD_SIZE);
    deviceSerial = u32(rf, 2);
    deviceModel = rf[13];
  }

  // ---- computed aggregates ----
  let avgDepthM: number | undefined;
  let minTempC: number | undefined;
  let maxTempC: number | undefined;
  let startPressureBar: number | undefined;
  let endPressureBar: number | undefined;
  let gasUsedBar: number | undefined;
  let consumptionBarPerMin: number | undefined;
  let minNdlMin: number | null | undefined;
  let maxCns: number | undefined;

  if (samples.length > 0) {
    const depths = samples.map((s) => s.depthM).filter((d) => d > 0);
    const temps = samples.map((s) => s.tempC);
    avgDepthM = depths.length
      ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
      : 0;
    minTempC = temps.length ? Math.min(...temps) : undefined;
    maxTempC = temps.length ? Math.max(...temps) : undefined;

    const tank0 = samples
      .map((s) => s.tank0Bar)
      .filter((p): p is number => p !== null);
    if (tank0.length > 0) {
      startPressureBar = tank0[0];
      endPressureBar = tank0[tank0.length - 1];
      gasUsedBar = Math.round((startPressureBar - endPressureBar) * 10) / 10;
      if (durationS && durationS > 0) {
        consumptionBarPerMin =
          Math.round((gasUsedBar / (durationS / 60.0)) * 10) / 10;
      }
    }

    const ndls = samples
      .filter((s) => s.decoType === "NDL" && s.ndlDecoMin > 0)
      .map((s) => s.ndlDecoMin);
    minNdlMin = ndls.length ? Math.min(...ndls) : null;

    maxCns = Math.max(...samples.map((s) => s.cns));
  }

  return {
    units,
    timestamp,
    datetimeUtc: fmtUtc(timestamp),
    gfLow,
    gfHigh,
    atmosphericMbar,
    decoModel,
    vpmbConservatism,
    waterDensity,
    waterType,
    diveMode,
    logVersion,
    aiMode,
    sampleIntervalMs,
    utcOffsetSec,
    dst,
    latitude,
    longitude,
    gasMixes,
    tanks,
    samples,
    maxDepthM,
    durationS,
    deviceSerial,
    deviceModel,
    avgDepthM,
    minTempC,
    maxTempC,
    startPressureBar,
    endPressureBar,
    gasUsedBar,
    consumptionBarPerMin,
    minNdlMin,
    maxCns,
  };
}
