import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { BleProvider } from './src/context/BleContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Dashboard } from './src/screens/Dashboard';
import { LdlTest } from './src/screens/LdlTest';
import { FilterBand } from './src/types';

type Screen = 'dashboard' | 'ldl';

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
      {screen === 'dashboard' ? (
        <Dashboard
          onOpenLdl={openLdl}
          importedBands={ldlBands}
          onImportConsumed={consumeLdlBands}
        />
      ) : (
        <LdlTest onClose={closeLdl} onApplyBands={setLdlBands} />
      )}
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
