import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BleProvider } from './src/context/BleContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Dashboard } from './src/screens/Dashboard';
import { LdlTest } from './src/screens/LdlTest';
import { FilterBand } from './src/types';

type Screen = 'dashboard' | 'ldl';

/**
 * On web, the phone layout renders inside a centered 480px column so the
 * mobile design can be evaluated accurately; on-device it's a no-op wrapper.
 */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (Platform.OS !== 'web') return <>{children}</>;

  return (
    <View style={[styles.frameOuter, { backgroundColor: c.frameBg }]}>
      <View
        style={[
          styles.frameInner,
          { backgroundColor: c.bg, borderColor: c.frameBorder },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function Root() {
  const { theme } = useTheme();
  const [screen, setScreen] = useState<Screen>('dashboard');
  // Bands produced by the LDL results screen, consumed once by the dashboard.
  const [ldlBands, setLdlBands] = useState<FilterBand[] | null>(null);

  const openLdl = useCallback(() => setScreen('ldl'), []);
  const closeLdl = useCallback(() => setScreen('dashboard'), []);
  const consumeLdlBands = useCallback(() => setLdlBands(null), []);

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <PhoneFrame>
        {screen === 'dashboard' ? (
          <Dashboard
            onOpenLdl={openLdl}
            importedBands={ldlBands}
            onImportConsumed={consumeLdlBands}
          />
        ) : (
          <LdlTest onClose={closeLdl} onApplyBands={setLdlBands} />
        )}
      </PhoneFrame>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BleProvider>
        <Root />
      </BleProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  frameOuter: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  frameInner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
});
