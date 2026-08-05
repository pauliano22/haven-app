import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';
import { FilterBand } from '../types';

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

interface BandMarker {
  id: string;
  notchX: number;
  notchY: number;
}

interface CurveData {
  curvePath: string;
  fillPath: string;
  baseline: number;
  bandMarkers: BandMarker[];
}

function buildCurve(width: number, bands: FilterBand[], dipScale: number): CurveData {
  const baseline = DRAW_H * 0.28;
  const maxDip = DRAW_H * 0.66;

  const pts: [number, number][] = [];
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const f = F_MIN * Math.pow(F_MAX / F_MIN, t);
    const x = t * width;
    // Composite: sum individual band dips, clamped to 1
    let totalDip = 0;
    for (const band of bands) {
      const sigmaOctaves = 1 / (band.q * 1.25);
      const logRatio = Math.log2(f / band.f0);
      const dip = Math.exp(-0.5 * Math.pow(logRatio / sigmaOctaves, 2)) * dipScale;
      totalDip = Math.min(1, totalDip + dip);
    }
    pts.push([x, baseline + totalDip * maxDip]);
  }

  const curvePath = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const fillPath = [
    `M0,${baseline.toFixed(1)}`,
    ...pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`),
    `L${width.toFixed(1)},${baseline.toFixed(1)} Z`,
  ].join(' ');

  const bandMarkers: BandMarker[] = bands.map(band => ({
    id: band.id,
    notchX: freqToX(band.f0, width),
    notchY: baseline + maxDip * dipScale,
  }));

  return { curvePath, fillPath, baseline, bandMarkers };
}

interface Props {
  bands: FilterBand[];
  selectedId: string;
  bypass: boolean;
}

export function VisualizerCurve({ bands, selectedId, bypass }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [svgWidth, setSvgWidth] = useState(0);

  const accent = bypass ? c.bypassOff : c.accent;

  const curve = useMemo<CurveData | null>(() => {
    if (svgWidth < 10) return null;
    return buildCurve(svgWidth, bands, bypass ? 0 : 1);
  }, [svgWidth, bands, bypass]);

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

            {/* Notch fill */}
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

            {/* Per-band markers (unselected first so selected renders on top) */}
            {!bypass && curve.bandMarkers
              .filter(m => m.id !== selectedId)
              .map(m => (
                <React.Fragment key={m.id}>
                  <Line
                    x1={m.notchX.toFixed(1)} y1="0"
                    x2={m.notchX.toFixed(1)} y2={DRAW_H}
                    stroke={accent}
                    strokeWidth={0.6}
                    strokeDasharray="3,4"
                    strokeOpacity={0.2}
                  />
                  <Circle
                    cx={m.notchX.toFixed(1)}
                    cy={m.notchY.toFixed(1)}
                    r={2.5}
                    fill={accent}
                    fillOpacity={0.4}
                  />
                </React.Fragment>
              ))}

            {/* Selected band marker — brighter */}
            {!bypass && curve.bandMarkers
              .filter(m => m.id === selectedId)
              .map(m => (
                <React.Fragment key={m.id}>
                  <Line
                    x1={m.notchX.toFixed(1)} y1="0"
                    x2={m.notchX.toFixed(1)} y2={DRAW_H}
                    stroke={accent}
                    strokeWidth={0.75}
                    strokeDasharray="3,4"
                    strokeOpacity={0.4}
                  />
                  <Circle
                    cx={m.notchX.toFixed(1)}
                    cy={m.notchY.toFixed(1)}
                    r={3.5}
                    fill={accent}
                  />
                </React.Fragment>
              ))}

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
