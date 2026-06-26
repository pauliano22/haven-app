import { StatusBar } from 'expo-status-bar';
import { BleProvider } from './src/context/BleContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { Dashboard } from './src/screens/Dashboard';

function Root() {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Dashboard />
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
