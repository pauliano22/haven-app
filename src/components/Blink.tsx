import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, TextStyle } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

/**
 * Soft terminal-cursor blink — a slow, even breath rather than a hard flash.
 * Holds steady when the system requests reduced motion.
 */
export function Blink({ children, style }: Props) {
  const opacity = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, opacity]);

  return <Animated.Text style={[style, { opacity }]}>{children}</Animated.Text>;
}
