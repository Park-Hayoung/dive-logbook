#!/usr/bin/env python3
"""
Shearwater Peregrine TX Dive Log Parser & Report Generator

Parses binary dive log files (Petrel Native Format) extracted from
a Shearwater Peregrine TX dive computer and generates:
  - dive_data.json: Structured JSON of all parsed dive data
  - dive_report.md: Markdown summary report
  - dive_report.html: Interactive Plotly.js visualization
"""

import struct
import json
import os
import sys
import glob
import argparse
from datetime import datetime, timezone

# Physical constants (from libdivecomputer/include/libdivecomputer/units.h)
PSI = 6894.75729   # Pa
BAR = 100000.0     # Pa
FEET = 0.3048      # m

# Dive modes
DIVE_MODES = {
    0: "CC", 1: "OC Tec", 2: "Gauge", 3: "PPO2",
    4: "SC", 5: "CC2", 6: "OC Rec", 7: "Freedive", 12: "Avelo"
}

# Deco models
DECO_MODELS = {0: "Bühlmann GF", 1: "VPM-B", 2: "VPM-B+GFS", 3: "DCIEM"}

# AI modes
AI_MODES = {0: "Off", 4: "HP CCR", 5: "On", 6: "On+GPS"}


def bcd_to_int(bcd_bytes):
    """Convert BCD-encoded bytes to integer."""
    result = 0
    for b in bcd_bytes:
        result = result * 100 + ((b >> 4) * 10 + (b & 0x0F))
    return result


def decode_tank_pressure(raw):
    """Decode tank pressure from 16-bit raw value.
    Returns (pressure_bar, battery_level) or (None, None) for special codes."""
    if raw >= 0xFFF0:
        return None, None
    pressure_2psi = raw & 0x0FFF
    battery = (raw >> 12) & 0x0F  # 0=normal, 1=critical, 2=warning
    if pressure_2psi == 0:
        return None, battery
    bar = pressure_2psi * 2 * PSI / BAR
    return round(bar, 1), battery


def parse_manifest(path):
    """Parse manifest.bin - returns list of (fingerprint, address) tuples for valid dives."""
    with open(path, "rb") as f:
        data = f.read()

    entries = []
    for i in range(0, len(data), 32):
        rec = data[i:i + 32]
        if len(rec) < 32:
            break
        header = struct.unpack_from(">H", rec, 0)[0]
        if header == 0xA5C4:  # valid
            fingerprint = struct.unpack_from(">I", rec, 4)[0]
            address = struct.unpack_from(">I", rec, 20)[0]
            entries.append({"fingerprint": fingerprint, "address": hex(address)})
    return sorted(entries, key=lambda x: x["fingerprint"])


def parse_dive_file(path):
    """Parse a single dive binary file (PNF format). Returns dict with all extracted data."""
    with open(path, "rb") as f:
        data = f.read()

    size = len(data)
    if size < 64:
        return None

    # Index all records by type
    opening = {}
    closing = {}
    final_offset = None
    sample_offsets = []
    info_events = []

    for i in range(0, size, 32):
        t = data[i]
        if 0x10 <= t <= 0x19:
            opening[t - 0x10] = i
        elif 0x20 <= t <= 0x29:
            closing[t - 0x20] = i
        elif t == 0xFF:
            final_offset = i
        elif t == 0x01:
            sample_offsets.append(i)
        elif t == 0x30:
            info_events.append(i)

    # Verify required opening records
    for r in range(5):
        if r not in opening:
            print(f"  Warning: Missing opening record {r} in {path}")
            return None

    result = {"file": os.path.basename(path), "sample_count": len(sample_offsets)}

    # --- Opening Record 0 (0x10): GF, units, timestamp, gases ---
    rec0 = data[opening[0]:opening[0] + 32]
    result["gf_low"] = rec0[4]
    result["gf_high"] = rec0[5]
    units = rec0[8]
    result["units"] = "imperial" if units == 1 else "metric"
    timestamp = struct.unpack_from(">I", rec0, 12)[0]
    result["timestamp"] = timestamp
    result["datetime_utc"] = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    gas_o2 = list(rec0[20:30])
    gas_he = list(rec0[30:32])

    # --- Opening Record 1 (0x11): He gases 2-9, atmospheric ---
    rec1 = data[opening[1]:opening[1] + 32]
    gas_he.extend(list(rec1[1:9]))
    atmospheric_mbar = struct.unpack_from(">H", rec1, 16)[0]
    result["atmospheric_mbar"] = atmospheric_mbar

    # --- Opening Record 2 (0x12): Deco model ---
    rec2 = data[opening[2]:opening[2] + 32]
    deco_model_id = rec2[18]
    result["deco_model"] = DECO_MODELS.get(deco_model_id, f"Unknown({deco_model_id})")
    if deco_model_id in (1, 2):
        result["vpmb_conservatism"] = rec2[19]

    # --- Opening Record 3 (0x13): Water density ---
    rec3 = data[opening[3]:opening[3] + 32]
    density = struct.unpack_from(">H", rec3, 3)[0]
    result["water_density"] = density
    result["water_type"] = "Fresh" if density == 1000 else "Salt"

    # --- Opening Record 4 (0x14): Dive mode, log version, AI ---
    rec4 = data[opening[4]:opening[4] + 32]
    dive_mode = rec4[1]
    result["dive_mode"] = DIVE_MODES.get(dive_mode, f"Unknown({dive_mode})")
    log_version = rec4[16]
    result["log_version"] = log_version
    gas_enabled_bits = struct.unpack_from(">H", rec4, 17)[0]
    ai_mode = rec4[28]
    result["ai_mode"] = AI_MODES.get(ai_mode, f"Unknown({ai_mode})")

    # Build gas mix list
    gas_mixes = []
    for i in range(10):
        if gas_o2[i] == 0 and gas_he[i] == 0:
            continue
        enabled = bool(gas_enabled_bits & (1 << i))
        gas_mixes.append({
            "index": i,
            "o2": gas_o2[i],
            "he": gas_he[i],
            "n2": 100 - gas_o2[i] - gas_he[i],
            "enabled": enabled,
            "diluent": i >= 5
        })
    result["gas_mixes"] = [g for g in gas_mixes if g["enabled"]]

    # --- Opening Record 5 (0x15): Tank info, sample interval ---
    tanks = []
    if 5 in opening and log_version >= 9:
        rec5 = data[opening[5]:opening[5] + 32]
        sample_interval_ms = struct.unpack_from(">H", rec5, 23)[0]
        result["sample_interval_ms"] = sample_interval_ms
        utc_offset = struct.unpack_from(">i", rec5, 26)[0]
        result["utc_offset_sec"] = utc_offset
        result["dst"] = rec5[30]

        t0_serial = bcd_to_int(rec5[1:4])
        t0_max = struct.unpack_from(">H", rec5, 6)[0]
        t0_reserve = struct.unpack_from(">H", rec5, 8)[0]
        t1_serial = bcd_to_int(rec5[10:13])
        t1_max = struct.unpack_from(">H", rec5, 15)[0]
        t1_reserve = struct.unpack_from(">H", rec5, 17)[0]

        tanks.append({"id": 0, "serial": t0_serial,
                       "max_pressure_bar": round(t0_max / 100.0, 1),
                       "reserve_bar": round(t0_reserve / 100.0, 1)})
        tanks.append({"id": 1, "serial": t1_serial,
                       "max_pressure_bar": round(t1_max / 100.0, 1),
                       "reserve_bar": round(t1_reserve / 100.0, 1)})
    else:
        sample_interval_ms = 10000

    # --- Opening Record 6 (0x16): Tank names ---
    if 6 in opening and log_version >= 13 and len(tanks) >= 2:
        rec6 = data[opening[6]:opening[6] + 32]
        tanks[0]["enabled"] = bool(rec6[19])
        tanks[0]["name"] = rec6[20:22].decode("ascii", errors="replace").strip("\x00")
        tanks[1]["enabled"] = bool(rec6[22])
        tanks[1]["name"] = rec6[23:25].decode("ascii", errors="replace").strip("\x00")

    result["tanks"] = tanks

    # --- Opening Record 9 (0x19): GPS location ---
    if 9 in opening and ai_mode == 6:  # AI_ON_GPS
        rec9 = data[opening[9]:opening[9] + 32]
        lat_raw = struct.unpack_from(">i", rec9, 21)[0]
        lon_raw = struct.unpack_from(">i", rec9, 25)[0]
        if not (lat_raw == 0 and lon_raw == 0) and not (lat_raw == -1 and lon_raw == -1):
            result["latitude"] = round(lat_raw / 100000.0, 5)
            result["longitude"] = round(lon_raw / 100000.0, 5)

    # --- Parse Dive Samples ---
    samples = []
    time_ms = 0
    for offset in sample_offsets:
        rec = data[offset:offset + 32]
        time_ms += sample_interval_ms
        time_s = time_ms / 1000.0

        # Depth (pnf offset = 1)
        depth_raw = struct.unpack_from(">H", rec, 1)[0]
        if units == 1:
            depth_m = round(depth_raw / 10.0 * FEET, 2)
        else:
            depth_m = round(depth_raw / 10.0, 1)

        # Deco stop depth
        deco_stop_raw = struct.unpack_from(">H", rec, 3)[0]
        if deco_stop_raw > 0:
            deco_type = "DECO"
            deco_stop_m = round(deco_stop_raw * FEET, 1) if units == 1 else deco_stop_raw
        else:
            deco_type = "NDL"
            deco_stop_m = 0

        # TTS
        tts_min = struct.unpack_from(">H", rec, 5)[0]

        # Gas
        o2_pct = rec[8]
        he_pct = rec[9]

        # NDL/deco time
        ndl_deco_min = rec[10]

        # Status
        status = rec[12]

        # Temperature
        temp_raw = rec[14]
        temp_signed = temp_raw if temp_raw < 128 else temp_raw - 256
        if temp_signed < 0:
            temp_signed += 102
            if temp_signed > 0:
                temp_signed = 0
        if units == 1:
            temp_c = round((temp_signed - 32.0) * 5.0 / 9.0, 1)
        else:
            temp_c = float(temp_signed)

        # Tank pressures: idx[0]=27 -> byte 28, idx[1]=19 -> byte 20
        tp0_raw = struct.unpack_from(">H", rec, 28)[0]
        tp1_raw = struct.unpack_from(">H", rec, 20)[0]
        tank0_bar, tank0_batt = decode_tank_pressure(tp0_raw)
        tank1_bar, tank1_batt = decode_tank_pressure(tp1_raw)

        # RBT
        rbt_raw = rec[22]
        rbt_min = rbt_raw if rbt_raw < 0xF0 else None

        # CNS
        cns = round(rec[23] / 100.0, 2)

        sample = {
            "time_s": time_s,
            "depth_m": depth_m,
            "temp_c": temp_c,
            "o2_pct": o2_pct,
            "he_pct": he_pct,
            "deco_type": deco_type,
            "deco_stop_m": deco_stop_m,
            "ndl_deco_min": ndl_deco_min,
            "tts_min": tts_min,
            "cns": cns,
        }
        if tank0_bar is not None:
            sample["tank0_bar"] = tank0_bar
        if tank1_bar is not None:
            sample["tank1_bar"] = tank1_bar
        if rbt_min is not None:
            sample["rbt_min"] = rbt_min

        samples.append(sample)

    result["samples"] = samples

    # --- Closing Record 0 (0x20): Max depth, dive time ---
    if 0 in closing:
        rec_c0 = data[closing[0]:closing[0] + 32]
        max_depth_raw = struct.unpack_from(">H", rec_c0, 4)[0]
        if units == 1:
            result["max_depth_m"] = round(max_depth_raw / 10.0 * FEET, 1)
        else:
            result["max_depth_m"] = round(max_depth_raw / 10.0, 1)
        dive_time_s = (rec_c0[6] << 16) | (rec_c0[7] << 8) | rec_c0[8]
        result["duration_s"] = dive_time_s
        result["duration_str"] = f"{dive_time_s // 60}:{dive_time_s % 60:02d}"

    # --- Final Record (0xFF) ---
    if final_offset is not None:
        rec_f = data[final_offset:final_offset + 32]
        result["device_serial"] = struct.unpack_from(">I", rec_f, 2)[0]
        result["device_model"] = rec_f[13]

    # --- Computed fields ---
    if samples:
        depths = [s["depth_m"] for s in samples if s["depth_m"] > 0]
        temps = [s["temp_c"] for s in samples]
        result["avg_depth_m"] = round(sum(depths) / len(depths), 1) if depths else 0
        result["min_temp_c"] = min(temps) if temps else None
        result["max_temp_c"] = max(temps) if temps else None

        # Tank pressure summary
        t0_pressures = [s["tank0_bar"] for s in samples if "tank0_bar" in s]
        if t0_pressures:
            result["start_pressure_bar"] = t0_pressures[0]
            result["end_pressure_bar"] = t0_pressures[-1]
            result["gas_used_bar"] = round(t0_pressures[0] - t0_pressures[-1], 1)
            if result.get("duration_s") and result["duration_s"] > 0:
                result["consumption_bar_per_min"] = round(
                    result["gas_used_bar"] / (result["duration_s"] / 60.0), 1)

        # Min NDL
        ndl_values = [s["ndl_deco_min"] for s in samples if s["deco_type"] == "NDL" and s["ndl_deco_min"] > 0]
        result["min_ndl_min"] = min(ndl_values) if ndl_values else None

        # Max CNS
        result["max_cns"] = max(s["cns"] for s in samples)

    return result


def parse_device_info(path):
    """Parse device_info.txt."""
    info = {}
    with open(path, "r") as f:
        for line in f:
            line = line.strip()
            if ": " in line:
                key, val = line.split(": ", 1)
                info[key.lower()] = val
    return info


def generate_md_report(dives, device_info, output_path):
    """Generate Markdown summary report."""
    lines = []
    lines.append("# Dive Log Report - Shearwater Peregrine TX\n")

    # Device info
    lines.append("## Device Information\n")
    lines.append(f"| Item | Value |")
    lines.append(f"|------|-------|")
    lines.append(f"| Serial | {device_info.get('serial', 'N/A')} |")
    lines.append(f"| Firmware | {device_info.get('firmware', 'N/A')} |")
    lines.append(f"| Hardware | {device_info.get('hardware', 'N/A')} |")
    lines.append(f"| Base Address | {device_info.get('base address', 'N/A')} |")
    lines.append(f"| Report Date | {datetime.now().strftime('%Y-%m-%d %H:%M')} |")
    lines.append("")

    # Overall stats
    total_time_s = sum(d.get("duration_s", 0) for d in dives)
    max_depth = max(d.get("max_depth_m", 0) for d in dives)
    all_temps = [t for d in dives for t in [d.get("min_temp_c"), d.get("max_temp_c")] if t is not None]
    dives_with_ai = [d for d in dives if d.get("start_pressure_bar")]

    lines.append("## Overall Statistics\n")
    lines.append(f"| Statistic | Value |")
    lines.append(f"|-----------|-------|")
    lines.append(f"| Total Dives | {len(dives)} |")
    lines.append(f"| Total Dive Time | {total_time_s // 3600}h {(total_time_s % 3600) // 60}m |")
    lines.append(f"| Max Depth | {max_depth} m |")
    lines.append(f"| Avg Max Depth | {round(sum(d.get('max_depth_m', 0) for d in dives) / len(dives), 1)} m |")
    if all_temps:
        lines.append(f"| Temperature Range | {min(all_temps):.0f} ~ {max(all_temps):.0f} °C |")
    lines.append(f"| Deco Model | {dives[0].get('deco_model', 'N/A')} |")
    lines.append(f"| GF Setting | {dives[0].get('gf_low', '')}/{dives[0].get('gf_high', '')} |")
    if dives_with_ai:
        avg_consumption = round(sum(d.get("consumption_bar_per_min", 0) for d in dives_with_ai) / len(dives_with_ai), 1)
        lines.append(f"| Avg Gas Consumption | {avg_consumption} bar/min |")
    lines.append("")

    # Dive summary table
    lines.append("## Dive Summary\n")
    lines.append("| # | Date (UTC) | Duration | Max Depth | Avg Depth | Min Temp | Gas | Start P | End P | Used | bar/min | GPS |")
    lines.append("|---|------------|----------|-----------|-----------|----------|-----|---------|-------|------|---------|-----|")

    for i, d in enumerate(dives, 1):
        date = d.get("datetime_utc", "")[:16]
        dur = d.get("duration_str", "N/A")
        maxd = f"{d.get('max_depth_m', 0):.1f}m"
        avgd = f"{d.get('avg_depth_m', 0):.1f}m"
        mint = f"{d.get('min_temp_c', 'N/A'):.0f}°C" if d.get("min_temp_c") is not None else "N/A"
        gas_list = d.get("gas_mixes", [])
        gas_str = ", ".join(f"{g['o2']}%" + (f"/{g['he']}%" if g['he'] > 0 else "") for g in gas_list if not g.get("diluent"))
        if not gas_str:
            gas_str = "Air"
        sp = f"{d.get('start_pressure_bar', 'N/A')}" if d.get("start_pressure_bar") else "-"
        ep = f"{d.get('end_pressure_bar', 'N/A')}" if d.get("end_pressure_bar") else "-"
        used = f"{d.get('gas_used_bar', '-')}" if d.get("gas_used_bar") else "-"
        bpm = f"{d.get('consumption_bar_per_min', '-')}" if d.get("consumption_bar_per_min") else "-"
        gps = f"{d['latitude']:.5f}, {d['longitude']:.5f}" if d.get("latitude") else "-"
        lines.append(f"| {i} | {date} | {dur} | {maxd} | {avgd} | {mint} | {gas_str} | {sp} | {ep} | {used} | {bpm} | {gps} |")

    lines.append("")

    # Group by date
    from collections import defaultdict
    date_groups = defaultdict(list)
    for d in dives:
        date_str = d.get("datetime_utc", "")[:10]
        date_groups[date_str].append(d)

    lines.append("## Diving Day Summary\n")
    for date_str in sorted(date_groups.keys()):
        group = date_groups[date_str]
        total_t = sum(d.get("duration_s", 0) for d in group)
        max_d = max(d.get("max_depth_m", 0) for d in group)
        lines.append(f"### {date_str} ({len(group)} dives)\n")
        lines.append(f"- Total time: {total_t // 60} min")
        lines.append(f"- Max depth: {max_d:.1f} m")
        temps = [t for d in group for t in [d.get("min_temp_c"), d.get("max_temp_c")] if t is not None]
        if temps:
            lines.append(f"- Temperature: {min(temps):.0f} ~ {max(temps):.0f} °C")
        lines.append("")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"  Markdown report: {output_path}")


def generate_html_report(dives, device_info, output_path):
    """Generate interactive HTML report with Plotly.js visualizations."""
    # Prepare dive data for JSON embedding (exclude full samples for overview)
    dive_summaries = []
    for d in dives:
        summary = {k: v for k, v in d.items() if k != "samples"}
        summary["sample_times"] = [s["time_s"] for s in d["samples"]]
        summary["sample_depths"] = [s["depth_m"] for s in d["samples"]]
        summary["sample_temps"] = [s["temp_c"] for s in d["samples"]]
        summary["sample_ndl"] = [s["ndl_deco_min"] if s["deco_type"] == "NDL" else -s["ndl_deco_min"] for s in d["samples"]]
        summary["sample_tank0"] = [s.get("tank0_bar") for s in d["samples"]]
        summary["sample_cns"] = [s["cns"] for s in d["samples"]]
        dive_summaries.append(summary)

    dive_json = json.dumps(dive_summaries, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dive Log Report - Shearwater Peregrine TX</title>
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
         background: #0a1628; color: #e0e6ed; padding: 20px; }}
  .header {{ text-align: center; padding: 30px 0; }}
  .header h1 {{ color: #4fc3f7; font-size: 28px; margin-bottom: 8px; }}
  .header p {{ color: #78909c; font-size: 14px; }}
  .card {{ background: #132238; border-radius: 12px; padding: 24px; margin: 20px 0;
           border: 1px solid #1e3a5f; }}
  .card h2 {{ color: #4fc3f7; font-size: 18px; margin-bottom: 16px; }}
  .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; }}
  .stat-box {{ background: #1a2d47; border-radius: 8px; padding: 16px; text-align: center; }}
  .stat-box .value {{ font-size: 28px; font-weight: 700; color: #4fc3f7; }}
  .stat-box .label {{ font-size: 12px; color: #78909c; margin-top: 4px; }}
  .selector {{ display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }}
  .selector select {{ background: #1a2d47; color: #e0e6ed; border: 1px solid #2a4a6b;
                       border-radius: 6px; padding: 8px 12px; font-size: 14px; min-width: 300px; }}
  .chart-container {{ width: 100%; }}
  .chart-row {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }}
  @media (max-width: 900px) {{ .chart-row {{ grid-template-columns: 1fr; }} }}
  table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  th, td {{ padding: 8px 12px; text-align: right; border-bottom: 1px solid #1e3a5f; }}
  th {{ background: #1a2d47; color: #4fc3f7; font-weight: 600; position: sticky; top: 0; }}
  td:first-child, th:first-child {{ text-align: left; }}
  tr:hover td {{ background: #1a2d47; }}
  .table-wrap {{ max-height: 500px; overflow-y: auto; }}
  #dive-map {{ height: 450px; border-radius: 8px; z-index: 1; }}
  .map-info {{ color: #546e7a; font-size: 13px; margin-top: 12px; }}
  .dive-marker {{
    background: #4fc3f7; color: #0a1628; font-weight: 700; font-size: 12px;
    width: 28px; height: 28px; border-radius: 50%; display: flex;
    align-items: center; justify-content: center; border: 2px solid #e0e6ed;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
  }}
  .leaflet-popup-content-wrapper {{
    background: #1a2d47 !important; color: #e0e6ed !important;
    border-radius: 8px !important; border: 1px solid #2a4a6b !important;
  }}
  .leaflet-popup-tip {{ background: #1a2d47 !important; }}
  .leaflet-popup-content {{ font-size: 13px; line-height: 1.6; }}
  .leaflet-popup-content .popup-title {{ color: #4fc3f7; font-weight: 700; font-size: 14px; margin-bottom: 4px; }}
  .leaflet-popup-content .popup-row {{ display: flex; justify-content: space-between; gap: 16px; }}
  .leaflet-popup-content .popup-label {{ color: #78909c; }}
</style>
</head>
<body>

<div class="header">
  <h1>Dive Log Report</h1>
  <p>Shearwater Peregrine TX &mdash; Serial: {device_info.get('serial', 'N/A')} &mdash;
     Firmware: {device_info.get('firmware', 'N/A')}</p>
</div>

<div class="card" id="stats-card">
  <h2>Overall Statistics</h2>
  <div class="stats-grid" id="stats-grid"></div>
</div>

<div class="card">
  <h2>Dive Overview</h2>
  <div class="chart-row">
    <div id="chart-overview" class="chart-container"></div>
    <div id="chart-scatter" class="chart-container"></div>
  </div>
</div>

<div class="card">
  <h2>Dive Profile</h2>
  <div class="selector">
    <label for="dive-select">Select Dive:</label>
    <select id="dive-select"></select>
  </div>
  <div id="chart-profile" class="chart-container"></div>
  <div class="chart-row" style="margin-top:16px;">
    <div id="chart-ndl" class="chart-container"></div>
    <div id="chart-tank" class="chart-container"></div>
  </div>
</div>

<div class="card">
  <h2>Temperature &amp; Consumption Trends</h2>
  <div class="chart-row">
    <div id="chart-temp-trend" class="chart-container"></div>
    <div id="chart-consumption" class="chart-container"></div>
  </div>
</div>

<div class="card" id="map-card">
  <h2>Dive Site Map</h2>
  <div id="dive-map"></div>
  <div class="map-info" id="map-info"></div>
</div>

<div class="card">
  <h2>All Dives Data</h2>
  <div class="table-wrap" id="dive-table"></div>
</div>

<script>
const dives = {dive_json};
const plotBg = '#132238';
const plotPaper = '#0a1628';
const plotGrid = '#1e3a5f';
const plotFont = {{ color: '#b0bec5', family: 'sans-serif' }};
const defaultLayout = {{
  paper_bgcolor: plotPaper, plot_bgcolor: plotBg,
  font: plotFont,
  margin: {{ l: 60, r: 60, t: 40, b: 50 }},
  xaxis: {{ gridcolor: plotGrid, zerolinecolor: plotGrid }},
  yaxis: {{ gridcolor: plotGrid, zerolinecolor: plotGrid }},
}};

// --- Stats ---
const totalDives = dives.length;
const totalTimeSec = dives.reduce((s, d) => s + (d.duration_s || 0), 0);
const maxDepth = Math.max(...dives.map(d => d.max_depth_m || 0));
const avgMaxDepth = (dives.reduce((s, d) => s + (d.max_depth_m || 0), 0) / totalDives).toFixed(1);
const allTemps = dives.flatMap(d => [d.min_temp_c, d.max_temp_c]).filter(t => t != null);
const tempRange = allTemps.length ? Math.min(...allTemps).toFixed(0) + ' ~ ' + Math.max(...allTemps).toFixed(0) + ' °C' : 'N/A';
const aiDives = dives.filter(d => d.consumption_bar_per_min);
const avgConsumption = aiDives.length ? (aiDives.reduce((s,d)=>s+d.consumption_bar_per_min,0)/aiDives.length).toFixed(1) : 'N/A';

const statsData = [
  {{ value: totalDives, label: 'Total Dives' }},
  {{ value: Math.floor(totalTimeSec/3600) + 'h ' + Math.floor((totalTimeSec%3600)/60) + 'm', label: 'Total Time' }},
  {{ value: maxDepth.toFixed(1) + ' m', label: 'Max Depth' }},
  {{ value: avgMaxDepth + ' m', label: 'Avg Max Depth' }},
  {{ value: tempRange, label: 'Temperature' }},
  {{ value: avgConsumption + ' bar/min', label: 'Avg Consumption' }},
  {{ value: dives[0]?.deco_model || 'N/A', label: 'Deco Model' }},
  {{ value: (dives[0]?.gf_low || '') + '/' + (dives[0]?.gf_high || ''), label: 'GF Setting' }},
];
document.getElementById('stats-grid').innerHTML = statsData.map(s =>
  `<div class="stat-box"><div class="value">${{s.value}}</div><div class="label">${{s.label}}</div></div>`
).join('');

// --- Overview bar chart ---
const labels = dives.map((d,i) => '#' + (i+1) + ' ' + (d.datetime_utc||'').substring(5,10));
Plotly.newPlot('chart-overview', [
  {{ x: labels, y: dives.map(d => d.max_depth_m), type: 'bar', name: 'Max Depth (m)',
     marker: {{ color: '#4fc3f7' }} }},
  {{ x: labels, y: dives.map(d => (d.duration_s||0)/60), type: 'bar', name: 'Duration (min)',
     marker: {{ color: '#81c784' }}, yaxis: 'y2' }}
], {{
  ...defaultLayout,
  title: {{ text: 'Max Depth & Duration', font: {{ size: 14, color: '#78909c' }} }},
  barmode: 'group',
  yaxis: {{ ...defaultLayout.yaxis, title: 'Depth (m)', autorange: 'reversed' }},
  yaxis2: {{ title: 'Duration (min)', overlaying: 'y', side: 'right',
             gridcolor: 'transparent', color: '#81c784' }},
  legend: {{ x: 0, y: 1.15, orientation: 'h', font: {{ size: 11 }} }},
}}, {{ responsive: true }});

// --- Scatter: depth vs duration ---
Plotly.newPlot('chart-scatter', [{{
  x: dives.map(d => (d.duration_s||0)/60),
  y: dives.map(d => d.max_depth_m),
  mode: 'markers+text',
  text: dives.map((d,i) => '#'+(i+1)),
  textposition: 'top center',
  textfont: {{ size: 10, color: '#78909c' }},
  marker: {{ size: 12, color: dives.map(d => d.min_temp_c || 25),
             colorscale: 'Portland', showscale: true,
             colorbar: {{ title: 'Temp °C', tickfont: {{ color: '#b0bec5' }}, titlefont: {{ color: '#b0bec5' }} }} }},
  type: 'scatter'
}}], {{
  ...defaultLayout,
  title: {{ text: 'Depth vs Duration', font: {{ size: 14, color: '#78909c' }} }},
  xaxis: {{ ...defaultLayout.xaxis, title: 'Duration (min)' }},
  yaxis: {{ ...defaultLayout.yaxis, title: 'Max Depth (m)', autorange: 'reversed' }},
}}, {{ responsive: true }});

// --- Dive selector ---
const sel = document.getElementById('dive-select');
dives.forEach((d, i) => {{
  const opt = document.createElement('option');
  opt.value = i;
  opt.text = `#${{i+1}} ${{(d.datetime_utc||'').substring(0,16)}} - ${{d.max_depth_m}}m / ${{d.duration_str}}`;
  sel.appendChild(opt);
}});
sel.selectedIndex = dives.length - 1;

function plotDiveProfile(idx) {{
  const d = dives[idx];
  const t = d.sample_times.map(s => s / 60);  // minutes

  // Depth + Temp profile
  const traces = [
    {{ x: t, y: d.sample_depths, name: 'Depth (m)', fill: 'tozeroy',
       fillcolor: 'rgba(79,195,247,0.15)', line: {{ color: '#4fc3f7', width: 2 }}, yaxis: 'y' }},
    {{ x: t, y: d.sample_temps, name: 'Temp (°C)',
       line: {{ color: '#ff8a65', width: 2, dash: 'dot' }}, yaxis: 'y2' }},
  ];
  Plotly.newPlot('chart-profile', traces, {{
    ...defaultLayout,
    title: {{ text: `Dive #${{idx+1}} Profile — ${{d.datetime_utc?.substring(0,16) || ''}}`, font: {{ size: 14, color: '#78909c' }} }},
    xaxis: {{ ...defaultLayout.xaxis, title: 'Time (min)' }},
    yaxis: {{ ...defaultLayout.yaxis, title: 'Depth (m)', autorange: 'reversed' }},
    yaxis2: {{ title: 'Temp (°C)', overlaying: 'y', side: 'right', gridcolor: 'transparent', color: '#ff8a65' }},
    legend: {{ x: 0, y: 1.12, orientation: 'h', font: {{ size: 11 }} }},
  }}, {{ responsive: true }});

  // NDL chart
  const ndlVals = d.sample_ndl;
  const ndlColors = ndlVals.map(v => v < 0 ? '#e53935' : v <= 10 ? '#ff8a65' : v <= 30 ? '#ffd54f' : '#81c784');
  Plotly.newPlot('chart-ndl', [{{
    x: t, y: ndlVals.map(v => Math.abs(v)),
    type: 'bar', name: 'NDL / Deco (min)',
    marker: {{ color: ndlColors }}
  }}], {{
    ...defaultLayout,
    title: {{ text: 'NDL / Deco Stop', font: {{ size: 14, color: '#78909c' }} }},
    xaxis: {{ ...defaultLayout.xaxis, title: 'Time (min)' }},
    yaxis: {{ ...defaultLayout.yaxis, title: 'Minutes' }},
    showlegend: false,
  }}, {{ responsive: true }});

  // Tank pressure
  const tankData = d.sample_tank0;
  const hasTank = tankData.some(v => v != null);
  if (hasTank) {{
    const validT = [], validP = [];
    tankData.forEach((p, j) => {{ if (p != null) {{ validT.push(t[j]); validP.push(p); }} }});
    Plotly.newPlot('chart-tank', [{{
      x: validT, y: validP, name: 'Tank Pressure (bar)',
      line: {{ color: '#ab47bc', width: 2 }}, fill: 'tozeroy',
      fillcolor: 'rgba(171,71,188,0.1)',
    }}], {{
      ...defaultLayout,
      title: {{ text: 'Tank Pressure', font: {{ size: 14, color: '#78909c' }} }},
      xaxis: {{ ...defaultLayout.xaxis, title: 'Time (min)' }},
      yaxis: {{ ...defaultLayout.yaxis, title: 'Pressure (bar)' }},
      showlegend: false,
    }}, {{ responsive: true }});
  }} else {{
    document.getElementById('chart-tank').innerHTML = '<p style="text-align:center;color:#546e7a;padding:60px;">No AI tank data for this dive</p>';
  }}
}}

sel.addEventListener('change', e => plotDiveProfile(parseInt(e.target.value)));
plotDiveProfile(dives.length - 1);

// --- Temperature trend ---
Plotly.newPlot('chart-temp-trend', [
  {{ x: labels, y: dives.map(d => d.min_temp_c), name: 'Min Temp',
     line: {{ color: '#4fc3f7' }}, mode: 'lines+markers' }},
  {{ x: labels, y: dives.map(d => d.max_temp_c), name: 'Max Temp',
     line: {{ color: '#ff8a65' }}, mode: 'lines+markers', fill: 'tonexty',
     fillcolor: 'rgba(255,138,101,0.1)' }},
], {{
  ...defaultLayout,
  title: {{ text: 'Temperature Trend', font: {{ size: 14, color: '#78909c' }} }},
  yaxis: {{ ...defaultLayout.yaxis, title: '°C' }},
  legend: {{ x: 0, y: 1.12, orientation: 'h', font: {{ size: 11 }} }},
}}, {{ responsive: true }});

// --- Consumption trend ---
const consDives = dives.filter(d => d.gas_used_bar);
if (consDives.length) {{
  const cLabels = consDives.map((d,i) => {{
    const idx = dives.indexOf(d);
    return '#' + (idx+1) + ' ' + (d.datetime_utc||'').substring(5,10);
  }});
  Plotly.newPlot('chart-consumption', [
    {{ x: cLabels, y: consDives.map(d => d.gas_used_bar), type: 'bar', name: 'Gas Used (bar)',
       marker: {{ color: '#ab47bc' }} }},
    {{ x: cLabels, y: consDives.map(d => d.consumption_bar_per_min), name: 'bar/min',
       mode: 'lines+markers', line: {{ color: '#ffd54f', width: 2 }}, yaxis: 'y2' }},
  ], {{
    ...defaultLayout,
    title: {{ text: 'Gas Consumption', font: {{ size: 14, color: '#78909c' }} }},
    yaxis: {{ ...defaultLayout.yaxis, title: 'Gas Used (bar)' }},
    yaxis2: {{ title: 'bar/min', overlaying: 'y', side: 'right', gridcolor: 'transparent', color: '#ffd54f' }},
    legend: {{ x: 0, y: 1.12, orientation: 'h', font: {{ size: 11 }} }},
  }}, {{ responsive: true }});
}}

// --- Data table ---
let tableHtml = '<table><thead><tr><th>#</th><th>Date</th><th>Duration</th><th>Max Depth</th><th>Avg Depth</th><th>Min Temp</th><th>Max Temp</th><th>Gas</th><th>Start P</th><th>End P</th><th>Used</th><th>bar/min</th><th>Min NDL</th><th>Max CNS</th><th>GPS</th></tr></thead><tbody>';
dives.forEach((d, i) => {{
  const gas = (d.gas_mixes || []).filter(g => !g.diluent).map(g => g.o2 + '%' + (g.he ? '/' + g.he + '%' : '')).join(', ') || 'Air';
  tableHtml += `<tr>
    <td>${{i+1}}</td>
    <td>${{(d.datetime_utc||'').substring(0,16)}}</td>
    <td>${{d.duration_str || 'N/A'}}</td>
    <td>${{d.max_depth_m?.toFixed(1) || 'N/A'}} m</td>
    <td>${{d.avg_depth_m?.toFixed(1) || 'N/A'}} m</td>
    <td>${{d.min_temp_c != null ? d.min_temp_c.toFixed(0) + '°C' : 'N/A'}}</td>
    <td>${{d.max_temp_c != null ? d.max_temp_c.toFixed(0) + '°C' : 'N/A'}}</td>
    <td>${{gas}}</td>
    <td>${{d.start_pressure_bar || '-'}}</td>
    <td>${{d.end_pressure_bar || '-'}}</td>
    <td>${{d.gas_used_bar || '-'}}</td>
    <td>${{d.consumption_bar_per_min || '-'}}</td>
    <td>${{d.min_ndl_min != null ? d.min_ndl_min + ' min' : '-'}}</td>
    <td>${{d.max_cns != null ? (d.max_cns*100).toFixed(0) + '%' : '-'}}</td>
    <td>${{d.latitude ? d.latitude.toFixed(5) + ', ' + d.longitude.toFixed(5) : '-'}}</td>
  </tr>`;
}});
tableHtml += '</tbody></table>';
document.getElementById('dive-table').innerHTML = tableHtml;

// --- Dive Site Map (Leaflet) ---
const gpsDives = dives.map((d, i) => ({{ ...d, idx: i }})).filter(d => d.latitude && d.longitude);
if (gpsDives.length) {{
  const map = L.map('dive-map', {{ zoomControl: true }});

  // Dark tile layer (CartoDB DarkMatter)
  L.tileLayer('https://{{s}}.basemaps.cartocdn.com/dark_all/{{z}}/{{x}}/{{y}}{{r}}.png', {{
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19
  }}).addTo(map);

  const markers = [];
  gpsDives.forEach(d => {{
    const num = d.idx + 1;
    const icon = L.divIcon({{
      className: '', html: `<div class="dive-marker">${{num}}</div>`, iconSize: [28, 28], iconAnchor: [14, 14]
    }});

    const gas = (d.gas_mixes || []).filter(g => !g.diluent).map(g => g.o2 + '%').join(', ') || 'Air';
    const popup = `
      <div class="popup-title">Dive #${{num}}</div>
      <div class="popup-row"><span class="popup-label">Date</span><span>${{(d.datetime_utc||'').substring(0,16)}}</span></div>
      <div class="popup-row"><span class="popup-label">Duration</span><span>${{d.duration_str}}</span></div>
      <div class="popup-row"><span class="popup-label">Max Depth</span><span>${{d.max_depth_m?.toFixed(1)}} m</span></div>
      <div class="popup-row"><span class="popup-label">Avg Depth</span><span>${{d.avg_depth_m?.toFixed(1)}} m</span></div>
      <div class="popup-row"><span class="popup-label">Temp</span><span>${{d.min_temp_c?.toFixed(0)}} ~ ${{d.max_temp_c?.toFixed(0)}} &deg;C</span></div>
      <div class="popup-row"><span class="popup-label">Gas</span><span>${{gas}}</span></div>
      ${{d.start_pressure_bar ? `<div class="popup-row"><span class="popup-label">Tank</span><span>${{d.start_pressure_bar}} &rarr; ${{d.end_pressure_bar}} bar</span></div>` : ''}}
      <div class="popup-row"><span class="popup-label">Coords</span><span>${{d.latitude.toFixed(5)}}, ${{d.longitude.toFixed(5)}}</span></div>
    `;

    const marker = L.marker([d.latitude, d.longitude], {{ icon }}).addTo(map).bindPopup(popup, {{ maxWidth: 280 }});
    markers.push(marker);
  }});

  // Fit bounds with padding
  const group = L.featureGroup(markers);
  map.fitBounds(group.getBounds().pad(0.3));

  // Info text
  const noGps = dives.length - gpsDives.length;
  document.getElementById('map-info').innerHTML =
    `${{gpsDives.length}} dives with GPS coordinates shown` +
    (noGps > 0 ? ` &mdash; ${{noGps}} dives without GPS data` : '');
}} else {{
  document.getElementById('dive-map').innerHTML = '<p style="text-align:center;color:#546e7a;padding:80px;">No GPS data available</p>';
  document.getElementById('dive-map').style.height = 'auto';
}}
</script>
</body>
</html>"""

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  HTML report: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Parse Shearwater Peregrine TX dive logs")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_logbook = os.path.join(script_dir, '..', 'data', 'raw')
    default_output = os.path.join(script_dir, '..', 'data', 'reports')
    parser.add_argument("--logbook-dir", default=default_logbook, help="Directory with dive log files")
    parser.add_argument("--output-dir", default=default_output, help="Output directory")
    args = parser.parse_args()

    logbook_dir = args.logbook_dir
    output_dir = args.output_dir
    os.makedirs(output_dir, exist_ok=True)

    # Parse device info
    device_info_path = os.path.join(logbook_dir, "device_info.txt")
    device_info = parse_device_info(device_info_path) if os.path.exists(device_info_path) else {}
    print(f"Device: {device_info.get('firmware', 'N/A')} (Serial: {device_info.get('serial', 'N/A')})")

    # Parse manifest
    manifest_path = os.path.join(logbook_dir, "manifest.bin")
    if os.path.exists(manifest_path):
        manifest = parse_manifest(manifest_path)
        print(f"Manifest: {len(manifest)} valid dives")
    else:
        manifest = []

    # Parse dive files
    dive_files = sorted(glob.glob(os.path.join(logbook_dir, "dive_*[0-9].bin")))
    print(f"Found {len(dive_files)} dive files\n")

    dives = []
    for fpath in dive_files:
        fname = os.path.basename(fpath)
        print(f"Parsing {fname}...")
        dive = parse_dive_file(fpath)
        if dive:
            dives.append(dive)
            print(f"  -> {dive['datetime_utc']} | {dive.get('duration_str', 'N/A')} | "
                  f"{dive.get('max_depth_m', 0):.1f}m | {dive.get('sample_count', 0)} samples")
        else:
            print(f"  -> FAILED to parse")

    print(f"\nSuccessfully parsed {len(dives)} dives")

    # Save JSON
    json_path = os.path.join(output_dir, "dive_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"device": device_info, "dives": dives}, f, ensure_ascii=False, indent=2)
    print(f"  JSON data: {json_path}")

    # Generate reports
    generate_md_report(dives, device_info, os.path.join(output_dir, "dive_report.md"))
    generate_html_report(dives, device_info, os.path.join(output_dir, "dive_report.html"))

    print("\nDone!")


if __name__ == "__main__":
    main()
