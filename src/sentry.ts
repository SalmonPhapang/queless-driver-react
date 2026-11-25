import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

const DSN =
  'https://da9bded0b4416215f2c59c374e7f39c4@o4512488594276352.ingest.de.sentry.io/4512488989982800';

Sentry.init({
  dsn: DSN,
  debug: __DEV__,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  sendDefaultPii: false,
  enableLogs: false,
  enableAutoConsoleLogs: false,
  profilesSampleRate: undefined,
  replaysSessionSampleRate: undefined,
  replaysOnErrorSampleRate: undefined,
  attachScreenshot: false,
  attachViewHierarchy: false,
});


export function wrapApp(
  Component: ComponentType<Record<string, unknown>>,
): ComponentType<Record<string, unknown>> {
  return Sentry.wrap(Component);
}
