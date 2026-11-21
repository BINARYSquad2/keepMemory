import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { DraftPhoto, MemoryDay, TrackInfo } from '../types/memory';

const TOKEN_KEY = 'keepmemory.authToken';
const ALBUM_KEY_PREFIX = 'km_album_';

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

/**
 * Превращает относительный путь с бэкенда (/uploads/...) в полный URL.
 * Работает одинаково с локальным Go-сервером и облачным Railway.
 */
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
    // Игнорируем ошибку локального кэша, основная запись уже сохранена на сервере
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

  // Если сервер уже отдаёт массив фото (после апдейта бэка / Railway) — используем его,
  // иначе подмешиваем сохранённые дополнительные кадры альбома с устройства.
  const extras = serverPhotos.length > 1 ? [] : await readLocalExtraPhotos(day.id);

  const merged: string[] = [];
  const pushUnique = (u: string) => {
    if (u && !merged.includes(u)) merged.push(u);
  };
  pushUnique(cover);
  serverPhotos.forEach(pushUnique);
  extras.forEach(pushUnique);

  return {
    ...day,
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
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (error) {
    const detail = error instanceof Error ? ` ${error.message}` : '';
    throw new Error(
      `Не удалось подключиться к серверу (${API_URL}). Проверьте сеть.${detail}`
    );
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

function detectPhotoMeta(uri: string, mimeType?: string): { name: string; type: string } {
  const mime = mimeType?.toLowerCase() ?? '';
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return { name: 'day-photo.jpg', type: 'image/jpeg' };
  }
  if (mime === 'image/png' || /\.png(?:$|[?#])/i.test(uri)) {
    return { name: 'day-photo.png', type: 'image/png' };
  }
  if (mime === 'image/webp' || /\.webp(?:$|[?#])/i.test(uri)) {
    return { name: 'day-photo.webp', type: 'image/webp' };
  }
  if (mime === 'image/heic' || /\.heic(?:$|[?#])/i.test(uri)) {
    return { name: 'day-photo.heic', type: 'image/heic' };
  }
  return { name: 'day-photo.jpg', type: 'image/jpeg' };
}

function buildMultipartBody(params: {
  text: string;
  track: TrackInfo;
  photoBase64: string;
  photoName: string;
  photoType: string;
}): { body: Uint8Array; contentType: string } {
  const boundary = `----KeepMemoryBoundary${Date.now().toString(16)}`;
  const prefix = utf8ToBytes(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="text"\r\n\r\n` +
      `${params.text}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="track"\r\n\r\n` +
      `${JSON.stringify(params.track)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="photo"; filename="${params.photoName}"\r\n` +
      `Content-Type: ${params.photoType}\r\n\r\n`
  );
  const photoBytes = base64ToBytes(params.photoBase64);
  const suffix = utf8ToBytes(`\r\n--${boundary}--\r\n`);

  const body = new Uint8Array(prefix.length + photoBytes.length + suffix.length);
  body.set(prefix, 0);
  body.set(photoBytes, prefix.length);
  body.set(suffix, prefix.length + photoBytes.length);

  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

export async function createDay(input: {
  text: string;
  photoUri: string;
  photoBase64?: string;
  photoMimeType?: string;
  photos?: DraftPhoto[];
  track: TrackInfo;
}): Promise<MemoryDay> {
  const coverDraft: DraftPhoto = input.photos?.[0] ?? {
    uri: input.photoUri,
    base64: input.photoBase64,
    mimeType: input.photoMimeType,
  };
  const extraUris = (input.photos ?? []).slice(1).map((p) => p.uri).filter(Boolean);
  const { name, type } = detectPhotoMeta(coverDraft.uri, coverDraft.mimeType);

  let created: MemoryDay;

  if (Platform.OS !== 'web' && coverDraft.base64) {
    const { body, contentType } = buildMultipartBody({
      text: input.text,
      track: input.track,
      photoBase64: coverDraft.base64,
      photoName: name,
      photoType: type,
    });

    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: body as unknown as BodyInit,
      headers: { 'Content-Type': contentType },
    });
    created = result.day;
  } else if (/^(?:file:|content:|blob:)/i.test(coverDraft.uri)) {
    const form = new FormData();
    form.append('text', input.text);
    form.append('track', JSON.stringify(input.track));

    if (Platform.OS === 'web' && coverDraft.uri.startsWith('blob:')) {
      const photo = await fetch(coverDraft.uri).then((response) => response.blob());
      form.append('photo', photo, name);
    } else {
      form.append('photo', {
        uri: coverDraft.uri,
        name,
        type,
      } as unknown as Blob);
    }

    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: form,
      headers: {},
    });
    created = result.day;
  } else {
    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: JSON.stringify({
        text: input.text,
        photoUri: coverDraft.uri,
        track: input.track,
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