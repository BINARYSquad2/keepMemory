import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DraftPhoto, MemoryDay, TrackInfo } from '../types/memory';

const TOKEN_KEY = 'keepmemory.authToken';
const ALBUM_KEY_PREFIX = 'km_album_';
const SAFE_GET_RETRY_LIMIT = 3;

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
export const API_URL =
  configuredApiUrl ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  bio: string;
  createdAt: string;
}

export interface ProfileUpdate {
  displayName: string;
  handle: string;
  bio: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof globalThis.localStorage === 'undefined') {
      throw new Error('Хранилище браузера недоступно');
    }
    globalThis.localStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearAuthToken(): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function hasAuthToken(): Promise<boolean> {
  return Boolean(await readToken());
}


export function resolveMediaUrl(uri: string): string {
  const trimmed = uri?.trim() ?? '';
  if (!trimmed) return '';
  if (/^blob:/i.test(trimmed) && Platform.OS !== 'web') {
    return '';
  }
  if (trimmed.startsWith('/')) {
    return `${API_URL}${trimmed}`;
  }
  return trimmed;
}

function albumStorageKey(dayId: string): string {
  const safeId = dayId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${ALBUM_KEY_PREFIX}${safeId}`;
}

async function saveLocalExtraPhotos(dayId: string, uris: string[]): Promise<void> {
  const cleaned = uris.map((u) => u.trim()).filter(Boolean).slice(0, 5);
  if (cleaned.length === 0) return;

  const key = albumStorageKey(dayId);
  const raw = JSON.stringify(cleaned);
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, raw);
    } else {
      await SecureStore.setItemAsync(key, raw);
    }
  } catch {

  }
}

async function clearLocalExtraPhotos(dayId: string): Promise<void> {
  const key = albumStorageKey(dayId);
  try {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {

  }
}

async function readLocalExtraPhotos(dayId: string): Promise<string[]> {
  const key = albumStorageKey(dayId);
  try {
    const raw =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(key)
        : await SecureStore.getItemAsync(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map(resolveMediaUrl)
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function hydrateMemoryDay(day: MemoryDay): Promise<MemoryDay> {
  const cover = resolveMediaUrl(day.photoUri);
  const serverPhotos = Array.isArray(day.photoUris)
    ? day.photoUris.map(resolveMediaUrl).filter(Boolean)
    : [];

  const extras = serverPhotos.length > 1 ? [] : await readLocalExtraPhotos(day.id);

  const merged: string[] = [];
  const pushUnique = (u: string) => {
    if (u && !merged.includes(u)) merged.push(u);
  };
  pushUnique(cover);
  serverPhotos.forEach(pushUnique);
  extras.forEach(pushUnique);

  const resolvedMood = day.mood ?? day.style?.mood;

  return {
    ...day,
    mood: resolvedMood,
    photoUri: merged[0] ?? cover,
    photoUris: merged,
  };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (
    init.body != null &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (requiresAuth) {
    const token = await readToken();
    if (!token) {
      throw new ApiError('Войдите в аккаунт, чтобы продолжить.', 401);
    }
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  const isSafeGet = (init.method ?? 'GET').toUpperCase() === 'GET';
  let attempt = 0;
  while (true) {
    try {
      response = await fetch(`${API_URL}${path}`, { ...init, headers });
    } catch (error) {
      if (isSafeGet && attempt < SAFE_GET_RETRY_LIMIT - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
        attempt += 1;
        continue;
      }
      const detail = error instanceof Error ? ` ${error.message}` : '';
      throw new Error(
        `Не удалось подключиться к серверу (${API_URL}). Проверьте сеть.${detail}`
      );
    }

    const retryableStatus =
      response.status === 408 ||
      response.status === 429 ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 503 ||
      response.status === 504;
    if (!isSafeGet || !retryableStatus || attempt >= SAFE_GET_RETRY_LIMIT - 1) {
      break;
    }

    const retryAfter = Number(response.headers.get('Retry-After'));
    const delay =
      Number.isFinite(retryAfter) && retryAfter >= 0
        ? Math.min(retryAfter * 1000, 2000)
        : 250 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt += 1;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Сервер вернул невалидный JSON (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : `Запрос завершился с ошибкой HTTP ${response.status}.`;

    if (requiresAuth && response.status === 401) {
      await clearAuthToken();
    }

    throw new ApiError(message, response.status);
  }

  return payload as T;
}

interface AuthResponse {
  token: string;
  tokenType: string;
  user: UserProfile;
}

export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<UserProfile> {
  const result = await request<AuthResponse>(
    '/api/auth/register',
    { method: 'POST', body: JSON.stringify(input) },
    false
  );
  await writeToken(result.token);
  return result.user;
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<UserProfile> {
  const result = await request<AuthResponse>(
    '/api/auth/login',
    { method: 'POST', body: JSON.stringify(input) },
    false
  );
  await writeToken(result.token);
  return result.user;
}

export async function getProfile(): Promise<UserProfile> {
  const result = await request<{ user: UserProfile }>('/api/profile');
  return result.user;
}

export async function updateProfile(input: ProfileUpdate): Promise<UserProfile> {
  const result = await request<{ user: UserProfile }>('/api/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  return result.user;
}

export async function getDays(): Promise<MemoryDay[]> {
  const result = await request<{ days: MemoryDay[] | null }>('/api/days');
  return Promise.all((result.days ?? []).map(hydrateMemoryDay));
}

export async function getDay(id: string): Promise<MemoryDay> {
  const result = await request<{ day: MemoryDay }>(
    `/api/days/${encodeURIComponent(id)}`
  );
  return hydrateMemoryDay(result.day);
}

export async function deleteDay(id: string): Promise<{ warning?: string }> {
  const result = await request<{ deleted: boolean; warning?: string }>(
    `/api/days/${encodeURIComponent(id)}`,
    { method: 'DELETE' }
  );
  await clearLocalExtraPhotos(id);
  return result;
}

export async function searchTracks(query: string): Promise<TrackInfo[]> {
  const result = await request<{ tracks: TrackInfo[] | null }>(
    `/api/tracks/search?q=${encodeURIComponent(query)}`
  );
  return result.tracks ?? [];
}

const BASE64_LOOKUP = (() => {
  const table = new Uint8Array(128);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (let i = 0; i < chars.length; i++) {
    table[chars.charCodeAt(i)] = i;
  }
  return table;
})();

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[\r\n\s]/g, '');
  const len = clean.length;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const byteLength = Math.floor((len * 3) / 4) - padding;
  const bytes = new Uint8Array(byteLength);

  let byteIndex = 0;
  for (let i = 0; i < len; i += 4) {
    const a = BASE64_LOOKUP[clean.charCodeAt(i)] ?? 0;
    const b = BASE64_LOOKUP[clean.charCodeAt(i + 1)] ?? 0;
    const c = clean[i + 2] === '=' ? 0 : (BASE64_LOOKUP[clean.charCodeAt(i + 2)] ?? 0);
    const d = clean[i + 3] === '=' ? 0 : (BASE64_LOOKUP[clean.charCodeAt(i + 3)] ?? 0);

    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triple >> 16) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = (triple >> 8) & 255;
    if (byteIndex < byteLength) bytes[byteIndex++] = triple & 255;
  }

  return bytes;
}

function utf8ToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

function detectPhotoMeta(
  uri: string,
  mimeType?: string,
  index = 0
): { name: string; type: string } {
  const suffix = index > 0 ? `-${index + 1}` : '';
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return { name: `day-photo${suffix}.jpg`, type: 'image/jpeg' };
  }
  if (mime === 'image/png' || /\.png(?:$|[?#])/i.test(uri)) {
    return { name: `day-photo${suffix}.png`, type: 'image/png' };
  }
  if (mime === 'image/webp' || /\.webp(?:$|[?#])/i.test(uri)) {
    return { name: `day-photo${suffix}.webp`, type: 'image/webp' };
  }
  if (mime === 'image/heic' || /\.heic(?:$|[?#])/i.test(uri)) {
    return { name: `day-photo${suffix}.heic`, type: 'image/heic' };
  }
  return { name: `day-photo${suffix}.jpg`, type: 'image/jpeg' };
}

interface MultipartPhotoPart {
  fieldName: 'photo' | 'photos';
  base64: string;
  name: string;
  type: string;
}

function buildMultipartBody(params: {
  text: string;
  track: TrackInfo;
  photos: MultipartPhotoPart[];
  allowCloudAI: boolean;
}): { body: Uint8Array; contentType: string } {
  const boundary = `----KeepMemoryBoundary${Date.now().toString(16)}`;
  const chunks: Uint8Array[] = [
    utf8ToBytes(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="text"\r\n\r\n` +
        `${params.text}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="track"\r\n\r\n` +
        `${JSON.stringify(params.track)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="allowCloudAI"\r\n\r\n` +
        `${params.allowCloudAI}\r\n`
    ),
  ];

  for (const photo of params.photos) {
    const safeName = photo.name.replace(/["\r\n]/g, '_');
    chunks.push(
      utf8ToBytes(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${photo.fieldName}"; filename="${safeName}"\r\n` +
          `Content-Type: ${photo.type}\r\n\r\n`
      )
    );
    chunks.push(base64ToBytes(photo.base64));
    chunks.push(utf8ToBytes('\r\n'));
  }

  chunks.push(utf8ToBytes(`--${boundary}--\r\n`));

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const body = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.length;
  }

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function sendNativeMultipartDay(
  text: string,
  track: TrackInfo,
  drafts: DraftPhoto[],
  allowCloudAI: boolean
): Promise<MemoryDay> {
  const parts: MultipartPhotoPart[] = [];
  drafts.forEach((draft, idx) => {
    if (!draft.base64) return;
    const meta = detectPhotoMeta(draft.uri, draft.mimeType, idx);
    parts.push({
      fieldName: idx === 0 ? 'photo' : 'photos',
      base64: draft.base64,
      name: meta.name,
      type: meta.type,
    });
  });

  const { body, contentType } = buildMultipartBody({
    text,
    track,
    photos: parts,
    allowCloudAI,
  });

  const result = await request<{ day: MemoryDay }>('/api/days', {
    method: 'POST',
    body: body as unknown as BodyInit,
    headers: { 'Content-Type': contentType },
  });
  return result.day;
}

async function sendFormDataDay(
  text: string,
  track: TrackInfo,
  drafts: DraftPhoto[],
  allowCloudAI: boolean
): Promise<MemoryDay> {
  const form = new FormData();
  form.append('text', text);
  form.append('track', JSON.stringify(track));
  form.append('allowCloudAI', String(allowCloudAI));

  for (let i = 0; i < drafts.length; i++) {
    const draft = drafts[i];
    const meta = detectPhotoMeta(draft.uri, draft.mimeType, i);
    const fieldName = i === 0 ? 'photo' : 'photos';

    if (Platform.OS === 'web' && draft.uri.startsWith('blob:')) {
      const photo = await fetch(draft.uri).then((response) => response.blob());
      form.append(fieldName, photo, meta.name);
    } else {
      form.append(fieldName, {
        uri: draft.uri,
        name: meta.name,
        type: meta.type,
      } as unknown as Blob);
    }
  }

  const result = await request<{ day: MemoryDay }>('/api/days', {
    method: 'POST',
    body: form,
    headers: {},
  });
  return result.day;
}

export async function createDay(input: {
  text: string;
  photoUri: string;
  photoBase64?: string;
  photoMimeType?: string;
  photos?: DraftPhoto[];
  track: TrackInfo;
  allowCloudAI?: boolean;
}): Promise<MemoryDay> {
  const drafts: DraftPhoto[] =
    input.photos && input.photos.length > 0
      ? input.photos
      : [
          {
            uri: input.photoUri,
            base64: input.photoBase64,
            mimeType: input.photoMimeType,
          },
        ];

  const coverDraft = drafts[0];
  const extraUris = drafts.slice(1).map((p) => p.uri).filter(Boolean);
  const allowCloudAI = input.allowCloudAI === true;
  const allHaveBase64 = drafts.every((draft) => Boolean(draft.base64));

  let created: MemoryDay;

  if (Platform.OS !== 'web' && allHaveBase64) {
    try {
      created = await sendNativeMultipartDay(input.text, input.track, drafts, allowCloudAI);
    } catch (err) {
      if (drafts.length > 1 && err instanceof ApiError && err.status === 413) {
        created = await sendNativeMultipartDay(input.text, input.track, [coverDraft], allowCloudAI);
      } else {
        throw err;
      }
    }
  } else if (/^(?:file:|content:|blob:)/i.test(coverDraft.uri)) {
    try {
      created = await sendFormDataDay(input.text, input.track, drafts, allowCloudAI);
    } catch (err) {
      if (drafts.length > 1 && err instanceof ApiError && err.status === 413) {
        created = await sendFormDataDay(input.text, input.track, [coverDraft], allowCloudAI);
      } else {
        throw err;
      }
    }
  } else {
    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: JSON.stringify({
        text: input.text,
        photoUri: coverDraft.uri,
        photoUris: drafts.map((d) => d.uri).filter(Boolean),
        track: input.track,
        allowCloudAI,
      }),
    });
    created = result.day;
  }

  if (extraUris.length > 0 && (!created.photoUris || created.photoUris.length <= 1)) {
    await saveLocalExtraPhotos(created.id, extraUris);
  }

  return hydrateMemoryDay(created);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
}