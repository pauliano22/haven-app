import { Platform } from 'react-native';

// Use a true monospace family so number readouts don't jitter width
export const MONO_FONT =
  Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) ?? 'monospace';

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
}

export interface Theme {
  dark: boolean;
  colors: ColorPalette;
}

// ── Surgical Dark Mode ──────────────────────────────────────────────────────
export const darkTheme: Theme = {
  dark: true,
  colors: {
    bg:                  '#0F1115',  // Deep Space
    cardBg:              '#1A1D24',  // Surface
    cardBgDeep:          '#13161C',
    border:              '#2A2E38',
    borderDeep:          '#22262F',
    accent:              '#00E5FF',  // Clinical Teal
    accentSecondary:     '#00B4CC',
    textPrimary:         '#FFFFFF',
    textSecondary:       '#8F9BB3',  // per spec
    statusConnected:     '#00E5FF',
    statusScanning:      '#FFAB00',  // Alert Amber
    statusDisconnected:  '#FFAB00',  // Alert Amber — warning, not error red
    statusIdle:          '#8F9BB3',
    btnConnectBg:        '#00E5FF',
    btnConnectText:      '#0F1115',
    btnDisconnectBg:     '#2A2E38',
    btnDisconnectBorder: '#FFAB00',
    qBadgeBg:            '#1E2230',
    bypassOn:            '#00E5FF',
    bypassOff:           '#FFAB00',  // Alert Amber for bypass state
    sliderMax:           '#2A2E38',
    sliderDisabled:      '#2A2E38',
    payloadText:         '#00E5FF',
    toggleBg:            '#1A1D24',
    toggleBorder:        '#2A2E38',
  },
};

// ── Clinical Light Mode ─────────────────────────────────────────────────────
export const lightTheme: Theme = {
  dark: false,
  colors: {
    bg:                  '#EEF2F7',
    cardBg:              '#FFFFFF',
    cardBgDeep:          '#F4F7FB',
    border:              '#D0DCE8',
    borderDeep:          '#C8D8E8',
    accent:              '#007A8C',  // darker teal for light backgrounds
    accentSecondary:     '#005F70',
    textPrimary:         '#0D1B2A',
    textSecondary:       '#5A7090',
    statusConnected:     '#007A8C',
    statusScanning:      '#C87000',
    statusDisconnected:  '#C87000',
    statusIdle:          '#5A7090',
    btnConnectBg:        '#007A8C',
    btnConnectText:      '#FFFFFF',
    btnDisconnectBg:     '#F0F4F8',
    btnDisconnectBorder: '#C87000',
    qBadgeBg:            '#EEF6F5',
    bypassOn:            '#007A8C',
    bypassOff:           '#C87000',
    sliderMax:           '#D0DCE8',
    sliderDisabled:      '#D0DCE8',
    payloadText:         '#007A8C',
    toggleBg:            '#FFFFFF',
    toggleBorder:        '#D0DCE8',
  },
};
