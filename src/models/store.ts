/** Port of lib/models/store_model.dart */
export interface Store {
  id: string;
  name: string;
  address: string;
  phone?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

const asString = (v: unknown): string | undefined =>
  v === null || v === undefined ? undefined : String(v);

const asDouble = (v: unknown): number | undefined => {
  if (typeof v === 'number') return v;
  const parsed = Number.parseFloat(String(v ?? ''));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const StoreModel = {
  fromJson(json: Record<string, unknown>): Store {
    return {
      id: asString(json.id) ?? '',
      name: asString(json.name) ?? '',
      address: asString(json.address) ?? '',
      phone: asString(json.phone),
      description: asString(json.description),
      imageUrl: asString(json.image_url),
      latitude: asDouble(json.latitude),
      longitude: asDouble(json.longitude),
    };
  },

  toJson(store: Store): Record<string, unknown> {
    return {
      id: store.id,
      name: store.name,
      address: store.address,
      ...(store.phone != null ? { phone: store.phone } : {}),
      ...(store.description != null ? { description: store.description } : {}),
      ...(store.imageUrl != null ? { image_url: store.imageUrl } : {}),
      ...(store.latitude != null ? { latitude: store.latitude } : {}),
      ...(store.longitude != null ? { longitude: store.longitude } : {}),
    };
  },
};
