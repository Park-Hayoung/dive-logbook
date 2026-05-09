import { View, Text } from "react-native";
import { colors } from "@/src/lib/colors";
import Svg, {
  Path,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Circle,
} from "react-native-svg";

import { useDiveSamples, type DiveSample } from "@/src/hooks/use-dive-samples";

type Props = {
  diveId: string;
  height?: number;
};

const COLORS = {
  axis: "#D1D5DB",
  grid: "#F3F4F6",
  curve: colors.brand[700],
  fill: colors.brand[600],
  text: "#6B7280",
  marker: "#DC2626",
};

export function DiveProfileGraph({ diveId, height = 200 }: Props) {
  const { data: samples, isLoading } = useDiveSamples(diveId);

  if (isLoading) {
    return (
      <View
        className="bg-white rounded-3xl border border-gray-100 items-center justify-center"
        style={{ height }}
      >
        <Text className="text-xs text-gray-400">프로파일 로딩 중...</Text>
      </View>
    );
  }
  if (!samples || samples.length < 2) return null;

  return (
    <View className="bg-white p-5 rounded-3xl border border-gray-100">
      <Text className="text-[10px] font-black text-gray-400 uppercase mb-3">
        Dive Profile
      </Text>
      <ProfileChart samples={samples} height={height} />
    </View>
  );
}

function ProfileChart({
  samples,
  height,
}: {
  samples: DiveSample[];
  height: number;
}) {
  const padX = 36;
  const padTop = 8;
  const padBottom = 24;
  const W = 320; // SVG viewBox width — scales via preserveAspectRatio
  const H = height;
  const innerW = W - padX - 8;
  const innerH = H - padTop - padBottom;

  const maxTime = samples[samples.length - 1].timeS;
  const maxDepth = Math.max(...samples.map((s) => s.depthM));
  // Round up depth axis to next 5m for nicer grid.
  const yMax = Math.max(5, Math.ceil(maxDepth / 5) * 5);

  const xScale = (t: number) => padX + (t / maxTime) * innerW;
  const yScale = (d: number) => padTop + (d / yMax) * innerH;

  // Find max-depth sample for marker.
  const maxIdx = samples.findIndex((s) => s.depthM === maxDepth);
  const maxSample = samples[maxIdx];

  // Build closed path for filled area.
  let path = `M ${xScale(0)} ${yScale(0)} `;
  for (const s of samples) {
    path += `L ${xScale(s.timeS).toFixed(1)} ${yScale(s.depthM).toFixed(1)} `;
  }
  path += `L ${xScale(maxTime)} ${yScale(0)} Z`;

  // Depth grid lines every 5m or 10m depending on max.
  const depthStep = yMax > 30 ? 10 : 5;
  const depthTicks: number[] = [];
  for (let d = depthStep; d <= yMax; d += depthStep) depthTicks.push(d);

  // Time ticks: 5 evenly spaced.
  const timeTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxTime * f));

  return (
    <View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <LinearGradient id="depthFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={COLORS.fill} stopOpacity="0.05" />
            <Stop offset="100%" stopColor={COLORS.fill} stopOpacity="0.25" />
          </LinearGradient>
        </Defs>

        {/* depth grid */}
        {depthTicks.map((d) => (
          <Line
            key={`gd-${d}`}
            x1={padX}
            y1={yScale(d)}
            x2={W - 8}
            y2={yScale(d)}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
        ))}

        {/* y-axis labels (depth, in meters) */}
        {depthTicks.map((d) => (
          <SvgText
            key={`ld-${d}`}
            x={padX - 4}
            y={yScale(d) + 3}
            fontSize={9}
            fill={COLORS.text}
            textAnchor="end"
          >
            {d}m
          </SvgText>
        ))}

        {/* x-axis ticks (time, mm:ss or mm) */}
        {timeTicks.map((t) => (
          <SvgText
            key={`lt-${t}`}
            x={xScale(t)}
            y={H - 6}
            fontSize={9}
            fill={COLORS.text}
            textAnchor="middle"
          >
            {formatMin(t)}
          </SvgText>
        ))}

        {/* surface line */}
        <Line
          x1={padX}
          y1={yScale(0)}
          x2={W - 8}
          y2={yScale(0)}
          stroke={COLORS.axis}
          strokeWidth={1}
        />

        {/* filled depth path */}
        <Path d={path} fill="url(#depthFill)" stroke="none" />

        {/* depth curve */}
        <Path
          d={
            "M " +
            samples
              .map(
                (s) => `${xScale(s.timeS).toFixed(1)} ${yScale(s.depthM).toFixed(1)}`,
              )
              .join(" L ")
          }
          fill="none"
          stroke={COLORS.curve}
          strokeWidth={1.6}
        />

        {/* max-depth marker */}
        {maxSample ? (
          <>
            <Circle
              cx={xScale(maxSample.timeS)}
              cy={yScale(maxSample.depthM)}
              r={3}
              fill={COLORS.marker}
            />
            <SvgText
              x={xScale(maxSample.timeS)}
              y={yScale(maxSample.depthM) + 12}
              fontSize={9}
              fontWeight="900"
              fill={COLORS.marker}
              textAnchor="middle"
            >
              MAX {maxDepth.toFixed(1)}m
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function formatMin(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (s === 0) return `${m}m`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
