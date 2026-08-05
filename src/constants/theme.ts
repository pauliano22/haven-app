import { Platform } from 'react-native';

// ── "Lamplight Terminal" design system ──────────────────────────────────────
// A hi-fi instrument panel lit by a warm lamp: pine-black ground, cream text,
// one amber "signal" accent, one vermilion "cut" accent. Never pure white,
// never cyan. Light mode is the same instrument on daylight paper.

// Mono carries the whole identity — hierarchy comes from weight/tracking/case.
export const MONO_FONT =
  Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) ?? 'monospace';

// Sans is reserved for instructional paragraphs (LDL intro) only.
export const SANS_FONT =
  Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }) ?? 'sans-serif';

/** Corner radius for cards/modules — crisp instrument, not app-store bubble. */
export const RADIUS = 6;
/** Radius for small chips/badges. */
export const RADIUS_SM = 3;

export interface ColorPalette {
  bg: string;
  cardBg: string;
  cardBgDeep: string;
  border: string;
  borderDeep: string;
  accent: string;
  accentSecondary: string;
  textPrimary: string;
  textSecondary: string;
  statusConnected: string;
  statusScanning: string;
  statusDisconnected: string;
  statusIdle: string;
  btnConnectBg: string;
  btnConnectText: string;
  btnDisconnectBg: string;
  btnDisconnectBorder: string;
  qBadgeBg: string;
  bypassOn: string;
  bypassOff: string;
  sliderMax: string;
  sliderDisabled: string;
  payloadText: string;
  toggleBg: string;
  toggleBorder: string;
  /** Page behind the app column on the web preview. */
  frameBg: string;
  frameBorder: string;
}

export interface Theme {
  dark: boolean;
  colors: ColorPalette;
}

// ── Dark: Lamplight Terminal ────────────────────────────────────────────────
export const darkTheme: Theme = {
  dark: true,
  colors: {
    bg:                  '#081714',  // Pine Black
    cardBg:              '#0F231F',  // Deep Moss module
    cardBgDeep:          '#061210',  // recessed wells (TX monitor)
    border:              '#20362F',
    borderDeep:          '#182B26',
    accent:              '#FFBD54',  // Signal Amber — live values, signal flowing
    accentSecondary:     '#D89A3A',
    textPrimary:         '#F2E8D5',  // Lamplight Cream — never pure white
    textSecondary:       '#8CA096',  // Sage Ash
    statusConnected:     '#FFBD54',
    statusScanning:      '#D89A3A',
    statusDisconnected:  '#E0584D',  // Vermilion — signal cut
    statusIdle:          '#8CA096',
    btnConnectBg:        '#FFBD54',
    btnConnectText:      '#081714',
    btnDisconnectBg:     '#0F231F',
    btnDisconnectBorder: '#E0584D',
    qBadgeBg:            '#132A24',
    bypassOn:            '#FFBD54',  // filter active = signal amber
    bypassOff:           '#E0584D',  // bypassed / stop = vermilion
    sliderMax:           '#24382F',
    sliderDisabled:      '#31453C',
    payloadText:         '#FFBD54',
    toggleBg:            '#0F231F',
    toggleBorder:        '#20362F',
    frameBg:             '#030B09',
    frameBorder:         '#1C302A',
  },
};

// ── Light: Daylight Paper ───────────────────────────────────────────────────
export const lightTheme: Theme = {
  dark: false,
  colors: {
    bg:                  '#F5EEDC',  // cream paper
    cardBg:              '#FCF7EA',
    cardBgDeep:          '#EFE6CF',
    border:              '#D9CCAD',
    borderDeep:          '#CBBE9F',
    accent:              '#8C5E0A',  // burnt amber, ink-dark for contrast
    accentSecondary:     '#6E4A08',
    textPrimary:         '#241E12',
    textSecondary:       '#77705A',
    statusConnected:     '#8C5E0A',
    statusScanning:      '#9A6A10',
    statusDisconnected:  '#B23A2E',  // brick
    statusIdle:          '#77705A',
    btnConnectBg:        '#241E12',  // ink button on paper
    btnConnectText:      '#F5EEDC',
    btnDisconnectBg:     '#F1E9D4',
    btnDisconnectBorder: '#B23A2E',
    qBadgeBg:            '#F0E7CE',
    bypassOn:            '#8C5E0A',
    bypassOff:           '#B23A2E',
    sliderMax:           '#D9CCAD',
    sliderDisabled:      '#CBBE9F',
    payloadText:         '#8C5E0A',
    toggleBg:            '#FCF7EA',
    toggleBorder:        '#D9CCAD',
    frameBg:             '#E7DCBF',
    frameBorder:         '#C9BB98',
  },
};
