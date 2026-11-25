import { create } from 'zustand';
import type { AppVersion } from '../models/appVersion';
import type { AppStoreUpdateStatus } from '../services/versionService';

interface UpdateState {
  update: { version: AppVersion; status: AppStoreUpdateStatus } | null;
  setUpdate: (update: { version: AppVersion; status: AppStoreUpdateStatus } | null) => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  update: null,
  setUpdate: (update) => set({ update }),
}));
