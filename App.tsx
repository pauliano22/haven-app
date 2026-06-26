import { StatusBar } from 'expo-status-bar';
import { BleProvider } from './src/context/BleContext';
import { Dashboard } from './src/screens/Dashboard';

export default function App() {
  return (
    <BleProvider>
      <StatusBar style="light" />
      <Dashboard />
    </BleProvider>
  );
}
