/**
 * Collections API — wrapper cho index-service.
 * Endpoint: GET /api/index/v1/collections/collections
 *
 * Response shape (envelope):
 * {
 *   message: string,
 *   info: { data: { collections: [{ id, collection_name, description, ... }] } }
 * }
 */

const BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/index`;

function authHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Collection {
  id: string;
  name: string;
  description: string;
}

interface CollectionOut {
  id: string;
  collection_name: string;
  description?: string | null;
  user_id?: string;
  provider_embedding?: string;
  provider_storage?: string;
}

interface CollectionsListResponse {
  message?: string;
  info?: {
    data?: {
      collections?: CollectionOut[];
    };
  };
  // Một số backend trả trực tiếp data:
  data?: { collections?: CollectionOut[] };
  collections?: CollectionOut[];
}

export const collectionsApi = {
  async list(): Promise<Collection[]> {
    const res = await fetch(`${BASE}/v1/collections/collections`, {
      headers: { 'Content-Type': 'application/json', ...authHeader() },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg =
        (body as { detail?: string; message?: string }).detail ??
        (body as { message?: string }).message ??
        `HTTP ${res.status}`;
      throw new Error(msg);
    }
    const json = (await res.json()) as CollectionsListResponse;
    const raw =
      json.info?.data?.collections ??
      json.data?.collections ??
      json.collections ??
      [];
    return raw.map(c => ({
      id:          c.id,
      name:        c.collection_name,
      description: c.description ?? '',
    }));
  },
};
