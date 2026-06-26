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

export const darkTheme: Theme = {
  dark: true,
  colors: {
    bg:                  '#060B14',
    cardBg:              '#0D1628',
    cardBgDeep:          '#080E1C',
    border:              '#1A2744',
    borderDeep:          '#10192E',
    accent:              '#00E5CC',
    accentSecondary:     '#00BFFF',
    textPrimary:         '#FFFFFF',
    textSecondary:       '#6B7FA3',
    statusConnected:     '#00E5CC',
    statusScanning:      '#FFB347',
    statusDisconnected:  '#FF4D6D',
    statusIdle:          '#6B7FA3',
    btnConnectBg:        '#00E5CC',
    btnConnectText:      '#060B14',
    btnDisconnectBg:     '#1A2744',
    btnDisconnectBorder: '#FF4D6D',
    qBadgeBg:            '#0A1E38',
    bypassOn:            '#00E5CC',
    bypassOff:           '#FF4D6D',
    sliderMax:           '#1A2744',
    sliderDisabled:      '#1A2744',
    payloadText:         '#4EC9B0',
    toggleBg:            '#0D1628',
    toggleBorder:        '#1A2744',
  },
};

export const lightTheme: Theme = {
  dark: false,
  colors: {
    bg:                  '#EEF2F7',
    cardBg:              '#FFFFFF',
    cardBgDeep:          '#F4F7FB',
    border:              '#D0DCE8',
    borderDeep:          '#C8D8E8',
    accent:              '#009688',
    accentSecondary:     '#0277BD',
    textPrimary:         '#0D1B2A',
    textSecondary:       '#5A7090',
    statusConnected:     '#009688',
    statusScanning:      '#E07B00',
    statusDisconnected:  '#C62828',
    statusIdle:          '#5A7090',
    btnConnectBg:        '#009688',
    btnConnectText:      '#FFFFFF',
    btnDisconnectBg:     '#F0F4F8',
    btnDisconnectBorder: '#C62828',
    qBadgeBg:            '#EEF6F5',
    bypassOn:            '#009688',
    bypassOff:           '#C62828',
    sliderMax:           '#D0DCE8',
    sliderDisabled:      '#D0DCE8',
    payloadText:         '#00695C',
    toggleBg:            '#FFFFFF',
    toggleBorder:        '#D0DCE8',
  },
};
