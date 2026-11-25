import React, { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { typography } from '../theme/typography';

export function NetworkBanner() {
  const { colors } = useTheme();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    void Network.getNetworkStateAsync().then((state) => {
      if (active) setOffline(!state.isConnected);
    });
    const timer = setInterval(() => {
      void Network.getNetworkStateAsync().then((state) => {
        if (active) setOffline(!state.isConnected);
      });
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (!offline) return null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.warning }]}>
      <Text style={[typography.labelSmall, styles.text]}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 6, alignItems: 'center' },
  text: { color: '#FFFFFF', fontWeight: '700' },
});
