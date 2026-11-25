import React from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';

interface QuelessLogoProps {
  size?: number;
  style?: StyleProp<ImageStyle>;
}

export function QuelessLogo({ size = 112, style }: QuelessLogoProps) {
  return (
    <Image
      source={require('../../assets/queless-logo.png')}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="Queless logo"
    />
  );
}
