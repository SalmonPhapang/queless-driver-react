// Port of lib/supabase/supabase_config.dart.
//
// Flutter initializes Supabase Flutter (persisting the session in
// SharedPreferences). On the web, supabase-js persists to localStorage, the
// direct equivalent of SharedPreferences.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { AppConfig } from './appConfig';
import { EdgeClient, EdgeFunctionException } from '../core/edgeClient';
import { edgeTelemetrySink } from '../core/edgeTelemetry';

const missingConfigMessage =
  'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example).';

let clientInstance: SupabaseClient | null = null;
let edgeInstance: EdgeClient | null = null;
let initFuture: Promise<void> | null = null;

/** Last known auth user, kept in sync with onAuthStateChange (Flutter parity). */
let cachedUser: User | null = null;

const getClient = (): SupabaseClient => {
  if (clientInstance) return clientInstance;
  if (!AppConfig.isSupabaseConfigured) throw new Error(missingConfigMessage);

  clientInstance = createClient(AppConfig.supabaseUrl, AppConfig.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

  // Prime the synchronous user cache and keep it fresh. `getSession` is safe
  // to call at module scope: it reads the persisted session.
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
      // functions-js throws FunctionsHttpError for non-2xx responses; the
      // server's JSON payload lives on `error.context`.
      let details: unknown = data;
      const context = (error as { context?: Response }).context;
      if (context && typeof context.json === 'function') {
        try {
          details = await context.json();
        } catch {
          // Keep whatever `data` held.
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

  /** Shared EdgeClient for invoking Supabase edge functions. */
  get edge(): EdgeClient {
    return getEdgeClient();
  },

  /** Synchronous signed-in user, mirroring `SupabaseConfig.auth.currentUser`. */
  get currentUser(): User | null {
    return cachedUser;
  },

  get currentUserId(): string | null {
    return cachedUser?.id ?? null;
  },

  /**
   * Idempotent startup, mirroring queless_core's `SupabaseStartup`: retrying
   * startup can never stack duplicate initializations or duplicate edge
   * loggers. A failed attempt stays retryable.
   */
  initialize(): Promise<void> {
    initFuture ??= (async () => {
      try {
        const client = getClient();
        await client.auth.getSession().then(({ data }) => {
          cachedUser = data.session?.user ?? null;
        });
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
        // A failed attempt must stay retryable.
        initFuture = null;
        throw error;
      }
    })();
    return initFuture;
  },
};
