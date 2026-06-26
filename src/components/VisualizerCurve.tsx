import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

const F_MIN = 200;
const F_MAX = 8000;
const SAMPLES = 300;
const SVG_H = 148;
const LABEL_H = 18;
const DRAW_H = SVG_H - LABEL_H;
const FREQ_MARKERS = [500, 1000, 2000, 4000, 8000];

function freqToX(f: number, width: number): number {
  return (Math.log(f / F_MIN) / Math.log(F_MAX / F_MIN)) * width;
}

interface CurveData {
  curvePath: string;
  fillPath: string;
  baseline: number;
  notchX: number;
  notchY: number;
}

function buildCurve(width: number, f0: number, q: number, dipScale: number): CurveData {
  const baseline = DRAW_H * 0.28;
  const maxDip = DRAW_H * 0.66;
  // sigma in octaves — higher Q = narrower notch
  const sigmaOctaves = 1 / (q * 1.25);

  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const f = F_MIN * Math.pow(F_MAX / F_MIN, t);
    const x = t * width;
    // Gaussian in log-frequency space → perfectly symmetric notch on log axis
    const logRatio = Math.log2(f / f0);
    const dip = Math.exp(-0.5 * Math.pow(logRatio / sigmaOctaves, 2)) * dipScale;
    pts.push([x, baseline + dip * maxDip]);
  }

  const curvePath = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  // Closed path from baseline, along curve, back to baseline — fills the notch area
  const fillPath = [
    `M0,${baseline.toFixed(1)}`,
    ...pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`),
    `L${width.toFixed(1)},${baseline.toFixed(1)} Z`,
  ].join(' ');

  const notchX = freqToX(f0, width);
  const notchY = baseline + maxDip * dipScale;

  return { curvePath, fillPath, baseline, notchX, notchY };
}

interface Props {
  f0: number;
  q: number;
  bypass: boolean;
}

export function VisualizerCurve({ f0, q, bypass }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [svgWidth, setSvgWidth] = useState(0);

  const accent = bypass ? c.bypassOff : c.accent;

  const curve = useMemo<CurveData | null>(() => {
    if (svgWidth < 10) return null;
    return buildCurve(svgWidth, f0, q, bypass ? 0 : 1);
  }, [svgWidth, f0, q, bypass]);

  return (
    <View style={[styles.card, { backgroundColor: c.cardBg, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.textSecondary }]}>FREQUENCY RESPONSE</Text>

      <View
        style={styles.svgWrap}
        onLayout={e => setSvgWidth(Math.floor(e.nativeEvent.layout.width))}
      >
        {curve && svgWidth > 0 && (
          <Svg width={svgWidth} height={SVG_H}>
            {/* Subtle vertical grid at common frequencies */}
            {FREQ_MARKERS.map(f => {
              const x = freqToX(f, svgWidth).toFixed(1);
              return (
                <Line
                  key={f}
                  x1={x} y1="0"
                  x2={x} y2={DRAW_H}
                  stroke={c.textSecondary}
                  strokeWidth={0.4}
                  strokeOpacity={0.2}
                />
              );
            })}

            {/* 0 dB baseline */}
            <Line
              x1="0" y1={curve.baseline.toFixed(1)}
              x2={svgWidth} y2={curve.baseline.toFixed(1)}
              stroke={accent}
              strokeWidth={0.7}
              strokeOpacity={0.25}
            />

            {/* Notch fill — very subtle teal/amber wash */}
            <Path d={curve.fillPath} fill={accent} fillOpacity={0.07} />

            {/* Outer glow */}
            <Path
              d={curve.curvePath}
              fill="none"
              stroke={accent}
              strokeWidth={10}
              strokeOpacity={0.07}
            />

            {/* Mid glow */}
            <Path
              d={curve.curvePath}
              fill="none"
              stroke={accent}
              strokeWidth={4}
              strokeOpacity={0.18}
            />

            {/* Crisp main curve */}
            <Path
              d={curve.curvePath}
              fill="none"
              stroke={accent}
              strokeWidth={1.75}
            />

            {/* f0 dashed vertical marker */}
            {!bypass && (
              <Line
                x1={curve.notchX.toFixed(1)} y1="0"
                x2={curve.notchX.toFixed(1)} y2={DRAW_H}
                stroke={accent}
                strokeWidth={0.75}
                strokeDasharray="3,4"
                strokeOpacity={0.4}
              />
            )}

            {/* Notch bottom dot */}
            {!bypass && (
              <Circle
                cx={curve.notchX.toFixed(1)}
                cy={curve.notchY.toFixed(1)}
                r={3.5}
                fill={accent}
              />
            )}

            {/* Frequency axis labels */}
            {FREQ_MARKERS.map(f => (
              <SvgText
                key={f}
                x={freqToX(f, svgWidth).toFixed(1)}
                y={SVG_H - 3}
                fontSize={8.5}
                fill={c.textSecondary}
                fillOpacity={0.55}
                textAnchor="middle"
              >
                {f >= 1000 ? `${f / 1000}k` : String(f)}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  svgWrap: {
    width: '100%',
  },
});
