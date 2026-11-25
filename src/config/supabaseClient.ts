// Native port of lib/supabase/supabase_config.dart.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppConfig } from './appConfig';
import { EdgeClient, EdgeFunctionException } from '../core/edgeClient';
import { edgeTelemetrySink } from '../core/edgeTelemetry';

const missingConfigMessage =
  'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (see .env.example).';

let clientInstance: SupabaseClient | null = null;
let edgeInstance: EdgeClient | null = null;
let initFuture: Promise<void> | null = null;
let cachedUser: User | null = null;

const getClient = (): SupabaseClient => {
  if (clientInstance) return clientInstance;
  if (!AppConfig.isSupabaseConfigured) throw new Error(missingConfigMessage);

  clientInstance = createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  void clientInstance.auth.getSession().then(({ data }) => {
    cachedUser = data.session?.user ?? null;
  });
  clientInstance.auth.onAuthStateChange((_event, session) => {
    cachedUser = session?.user ?? null;
  });

  return clientInstance;
};

const getEdgeClient = (): EdgeClient => {
  if (edgeInstance) return edgeInstance;
  edgeInstance = new EdgeClient(async (functionName, body, options) => {
    const { data, error } = await getClient().functions.invoke(functionName, {
      body,
      headers: options?.headers,
    });
    if (error) {
      let details: unknown = data;
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          details = await context.json();
        } catch {
          // Keep whatever data held.
        }
      }
      const message =
        (details && typeof details === 'object'
          ? String(
              (details as Record<string, unknown>).error ??
                (details as Record<string, unknown>).message ??
                '',
            )
          : '') || error.message || `Edge function ${functionName} failed`;
      throw new EdgeFunctionException(message, {
        status: context?.status,
        data: details,
      });
    }
    return data;
  });
  return edgeInstance;
};

export const SupabaseConfig = {
  get client(): SupabaseClient {
    return getClient();
  },

  get auth() {
    return getClient().auth;
  },

  get edge(): EdgeClient {
    return getEdgeClient();
  },

  get currentUser(): User | null {
    return cachedUser;
  },

  get currentUserId(): string | null {
    return cachedUser?.id ?? null;
  },

  initialize(): Promise<void> {
    initFuture ??= (async () => {
      try {
        const client = getClient();
        const { data } = await client.auth.getSession();
        cachedUser = data.session?.user ?? null;
        EdgeClient.installDefaultLogger({
          forwardTo: edgeTelemetrySink({
            app: 'driver',
            writer: async (event) => {
              await getClient()
                .from('edge_call_events')
                .insert({ ...event, user_id: SupabaseConfig.currentUserId });
            },
          }),
        });
      } catch (error) {
        initFuture = null;
        throw error;
      }
    })();
    return initFuture;
  },
};
