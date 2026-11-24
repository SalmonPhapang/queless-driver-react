// Port of lib/services/version_service.dart.
//
// Flutter reads the installed build number from PackageInfo; the web build
// takes it from VITE_APP_BUILD_NUMBER (set at build time), so the same
// `app_versions` row drives the update dialog.

import { SupabaseConfig } from '../config/supabaseClient';
import { AppConfig } from '../config/appConfig';
import { AppVersion, AppVersionModel } from '../models/appVersion';

export type AppStoreUpdateStatus = 'none' | 'recommended' | 'forced';

export interface UpdateCheckResult {
  status: AppStoreUpdateStatus;
  version: AppVersion | null;
}

export const VersionService = {
  /** Checks if an update is available and returns the status + version info. */
  async checkForUpdate(): Promise<UpdateCheckResult> {
    try {
      const currentBuildNumber = AppConfig.appBuildNumber;

      const { data: response, error } = await SupabaseConfig.client
        .from('app_versions')
        .select('*')
        .eq('app_name', 'driver')
        .eq('is_active', true)
        .order('build_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!response) return { status: 'none', version: null };

      const latestVersion = AppVersionModel.fromJson(response as Record<string, unknown>);

      if (currentBuildNumber < latestVersion.minBuildNumber) {
        return { status: 'forced', version: latestVersion };
      }

      if (currentBuildNumber < latestVersion.buildNumber) {
        if (latestVersion.isForceUpdate) {
          return { status: 'forced', version: latestVersion };
        }
        return { status: 'recommended', version: latestVersion };
      }

      return { status: 'none', version: latestVersion };
    } catch (error) {
      console.debug('Error checking for update:', error);
      return { status: 'none', version: null };
    }
  },
};
