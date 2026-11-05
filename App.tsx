import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { DemoBanner } from './src/components/DemoBanner';
import { FadeIn } from './src/components/FadeIn';
import { TabBar } from './src/components/TabBar';
import { BleProvider } from './src/context/BleContext';
import { FilterProvider } from './src/context/FilterContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Tab } from './src/navigation';
import { Hearing } from './src/screens/Hearing';
import { Home } from './src/screens/Home';
import { Tune } from './src/screens/Tune';
import { seedDemoDataOnce } from './src/services/demoSeed';
import { isDemoMode } from './src/utils/demoMode';

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
  const [tab, setTab] = useState<Tab>('home');

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <PhoneFrame>
        <DemoBanner />
        <View style={styles.body}>
          <FadeIn key={tab}>
            {tab === 'home' && <Home onNavigate={setTab} />}
            {tab === 'tune' && <Tune />}
            {tab === 'hearing' && <Hearing />}
          </FadeIn>
        </View>
        <TabBar active={tab} onSelect={setTab} />
      </PhoneFrame>
    </>
  );
}

/**
 * Demo mode writes its example history before any store is read, so the
 * providers below load it on mount like real saved data. Outside demo mode
 * this renders immediately.
 */
function useDemoSeed(): boolean {
  const demo = isDemoMode();
  const [ready, setReady] = useState(!demo);
  useEffect(() => {
    if (!demo) return;
    void seedDemoDataOnce().then(() => setReady(true));
  }, [demo]);
  return ready;
}

export default function App() {
  const ready = useDemoSeed();
  if (!ready) return null;
  return (
    <ThemeProvider>
      <BleProvider>
        <FilterProvider>
          <Root />
        </FilterProvider>
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
  body: {
    flex: 1,
  },
});
