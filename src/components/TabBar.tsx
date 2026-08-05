import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ColorPalette, SANS_FONT } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { Tab } from '../navigation';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'tune', label: 'Tune' },
  { key: 'hearing', label: 'Hearing' },
];

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

export function TabBar({ active, onSelect }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <View style={styles.bar}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            <View style={[styles.indicator, isActive && styles.indicatorActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function makeStyles(c: ColorPalette) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: c.border,
      backgroundColor: c.cardBgDeep,
      paddingTop: 12,
      paddingBottom: 8,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
    },
    label: {
      fontFamily: SANS_FONT,
      fontSize: 12.5,
      fontWeight: '600',
      color: c.textSecondary,
    },
    labelActive: {
      color: c.accent,
    },
    indicator: {
      width: 4,
      height: 4,
      borderRadius: 2,
      marginTop: 6,
      backgroundColor: 'transparent',
    },
    indicatorActive: {
      backgroundColor: c.accent,
    },
  });
}
