import { Platform } from 'react-native';

// ── "Sanctuary · Evergreen" design system ───────────────────────────────────
// Haven is a wellness device, not a console. Deep evergreen warmed by ivory
// text and a honey glow — the Hermes *brand* warmth, not its terminal. Serif
// display type, soft rounded surfaces, generous air. Every screen answers one
// question calmly.

/** Display face — warm, editorial. Headings and big readouts only. */
export const SERIF_FONT =
  Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }) ?? 'serif';

/** Body/UI face. */
export const SANS_FONT =
  Platform.select({ ios: 'System', android: 'sans-serif', default: 'sans-serif' }) ?? 'sans-serif';

/** Retained for engineering/debug surfaces only — not part of the brand UI. */
export const MONO_FONT =
  Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) ?? 'monospace';

/** Soft card radius. */
export const RADIUS = 20;
/** Buttons, chips, inner surfaces. */
export const RADIUS_SM = 12;

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

// ── Dark: Evergreen ─────────────────────────────────────────────────────────
export const darkTheme: Theme = {
  dark: true,
  colors: {
    bg:                  '#111F1A',  // deep evergreen
    cardBg:              '#1A2B25',
    cardBgDeep:          '#0D1814',
    border:              '#27392F',
    borderDeep:          '#1F3029',
    accent:              '#E9A860',  // honey glow
    accentSecondary:     '#C98D4B',
    textPrimary:         '#F4EEE1',  // warm ivory
    textSecondary:       '#9CADA0',
    statusConnected:     '#E9A860',
    statusScanning:      '#C98D4B',
    statusDisconnected:  '#D2604F',  // terracotta — reserved for stop/paused/alerts
    statusIdle:          '#9CADA0',
    btnConnectBg:        '#E9A860',
    btnConnectText:      '#111F1A',
    btnDisconnectBg:     '#1A2B25',
    btnDisconnectBorder: '#D2604F',
    qBadgeBg:            '#20332B',
    bypassOn:            '#E9A860',
    bypassOff:           '#D2604F',
    sliderMax:           '#2B3E34',
    sliderDisabled:      '#374A3F',
    payloadText:         '#E9A860',
    toggleBg:            '#1A2B25',
    toggleBorder:        '#27392F',
    frameBg:             '#0A1310',
    frameBorder:         '#22332B',
  },
};

// ── Light: Ivory ────────────────────────────────────────────────────────────
export const lightTheme: Theme = {
  dark: false,
  colors: {
    bg:                  '#F6F1E6',  // warm ivory
    cardBg:              '#FDFAF3',
    cardBgDeep:          '#EFE8D8',
    border:              '#E2D8C4',
    borderDeep:          '#D6CBB3',
    accent:              '#9C6410',  // deep honey — ink-strength on ivory
    accentSecondary:     '#7C4F0C',
    textPrimary:         '#27221A',
    textSecondary:       '#7E7869',
    statusConnected:     '#9C6410',
    statusScanning:      '#8A5A0E',
    statusDisconnected:  '#B5473A',
    statusIdle:          '#7E7869',
    btnConnectBg:        '#9C6410',
    btnConnectText:      '#FDFAF3',
    btnDisconnectBg:     '#F2ECDD',
    btnDisconnectBorder: '#B5473A',
    qBadgeBg:            '#F1EADA',
    bypassOn:            '#9C6410',
    bypassOff:           '#B5473A',
    sliderMax:           '#DFD5BF',
    sliderDisabled:      '#D2C7AF',
    payloadText:         '#9C6410',
    toggleBg:            '#FDFAF3',
    toggleBorder:        '#E2D8C4',
    frameBg:             '#E9E1CF',
    frameBorder:         '#D2C7AC',
  },
};
