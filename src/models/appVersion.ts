/** Port of lib/models/app_version_model.dart. */
export interface AppVersion {
  id: string;
  appType: string;
  version: string;
  buildNumber: number;
  minBuildNumber: number;
  releaseNotes?: string | null;
  downloadUrl?: string | null;
  isActive: boolean;
  isForceUpdate: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const asDate = (value: unknown): Date => {
  const date = new Date(String(value ?? ''));
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const AppVersionModel = {
  fromJson(json: Record<string, unknown>): AppVersion {
    return {
      id: String(json.id ?? ''),
      appType: String(json.app_name ?? json.app_type ?? 'driver'),
      version: String(json.version ?? ''),
      buildNumber: Number(json.build_number ?? 0),
      minBuildNumber: Number(json.min_build_number ?? 0),
      releaseNotes: json.release_notes == null ? null : String(json.release_notes),
      downloadUrl: json.download_url == null ? null : String(json.download_url),
      isActive: json.is_active === true,
      isForceUpdate: json.is_force_update === true,
      createdAt: asDate(json.created_at),
      updatedAt: asDate(json.updated_at),
    };
  },

  toJson(v: AppVersion): Record<string, unknown> {
    return {
      id: v.id,
      app_name: v.appType,
      version: v.version,
      build_number: v.buildNumber,
      min_build_number: v.minBuildNumber,
      release_notes: v.releaseNotes,
      download_url: v.downloadUrl,
      is_active: v.isActive,
      is_force_update: v.isForceUpdate,
      created_at: v.createdAt.toISOString(),
      updated_at: v.updatedAt.toISOString(),
    };
  },
};
