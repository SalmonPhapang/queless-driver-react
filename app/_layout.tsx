import '../src/sentry';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ToastHost } from '../src/components/ToastHost';
import { DialogHost } from '../src/components/DialogHost';
import { NetworkBanner } from '../src/components/NetworkBanner';
import { UpdateDialog } from '../src/components/UpdateDialog';
import { Button } from '../src/components/Button';
import { LoadingScreen } from '../src/components/Spinner';
import { wrapApp } from '../src/sentry';
import { SupabaseConfig } from '../src/config/supabaseClient';
import { errorMessage } from '../src/lib/errors';
import { Prefs } from '../src/lib/storage';
import { AuthService } from '../src/services/authService';
import { BackgroundLocationService } from '../src/services/backgroundLocationService';
import { DeviceBindingPolicy } from '../src/services/deviceBindingPolicy';
import { PushService } from '../src/services/pushService';
import { ShorebirdService } from '../src/services/shorebirdService';
import { VersionService } from '../src/services/versionService';
import { useUpdateStore } from '../src/stores/updateStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useAppFonts } from '../src/theme/fonts';
import { typography } from '../src/theme/typography';
import {
  hideAndroidNavigationBar,
  NavigationBarComponent,
} from '../src/utils/navigationBar';

function useFullscreen() {
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const hideSystemBars = () => {
      StatusBar.setHidden(true);
      if (Platform.OS === 'android') hideAndroidNavigationBar();
    };
    const hideAfterTransitions = () => {
      hideSystemBars();
      timers.push(setTimeout(hideSystemBars, 250));
    };

    hideAfterTransitions();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') hideAfterTransitions();
    });

    return () => {
      subscription.remove();
      timers.forEach(clearTimeout);
    };
  }, []);
}

function RootNavigator() {
  const { colors } = useTheme();
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const setUpdate = useUpdateStore((state) => state.setUpdate);

  const initialize = useCallback(async () => {
    setStartupError(null);
    setReady(false);
    try {
      await Prefs.init();
      await SupabaseConfig.initialize();
      await DeviceBindingPolicy.refresh();
      await PushService.initialize();
      await BackgroundLocationService.initialize();
      void ShorebirdService.initialize();
      await AuthService.restoreSession();
      setReady(true);
    } catch (error) {
      setStartupError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void initialize();
  }, [initialize, startupAttempt]);

  useEffect(() => {
    void (async () => {
      const result = await VersionService.checkForUpdate();
      if (result.status !== 'none' && result.version) {
        setUpdate({ version: result.version, status: result.status });
      }
    })();
  }, [setUpdate]);

  if (startupError) {
    return (
      <View style={[styles.errorState, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={styles.errorContent}>
          <Text style={[typography.titleLarge, styles.errorTitle, { color: colors.text }]}>
            Could not start Queless Driver
          </Text>
          <Text style={[typography.bodyMedium, styles.errorMessage, { color: colors.textMuted }]}>
            {startupError}
          </Text>
          <Button title="Retry" onPress={() => setStartupAttempt((attempt) => attempt + 1)} />
        </ScrollView>
      </View>
    );
  }

  if (!ready) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <NetworkBanner />
      <ToastHost />
      <DialogHost />
      <UpdateDialogHost />
      <Stack
        screenOptions={{
          headerShown: false,
          statusBarHidden: true,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="signup" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="permissions" />
        <Stack.Screen name="registration-success" />
        <Stack.Screen name="approval-success" />
        <Stack.Screen name="home" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="orders/[orderId]" />
      </Stack>
    </View>
  );
}

function UpdateDialogHost() {
  const update = useUpdateStore((state) => state.update);
  const setUpdate = useUpdateStore((state) => state.setUpdate);
  if (!update) return null;
  return (
    <UpdateDialog version={update.version} status={update.status} onClose={() => setUpdate(null)} />
  );
}

function RootLayout() {
  const [fontsLoaded] = useAppFonts();
  useFullscreen();
  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <StatusBar hidden style="light" />
        {NavigationBarComponent ? <NavigationBarComponent hidden /> : null}
        {fontsLoaded ? <RootNavigator /> : <LoadingScreen message="Preparing Queless…" />}
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorState: { flex: 1 },
  errorContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { textAlign: 'center' },
  errorMessage: { textAlign: 'center', marginBottom: 8 },
});

export default wrapApp(RootLayout);
