import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MemoryDay, TrackInfo } from '../types/memory';

const TOKEN_KEY = 'keepmemory.authToken';
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

function normalizeMemoryPhoto(day: MemoryDay): MemoryDay {
  return {
    ...day,
    photoUri: resolveMediaUrl(day.photoUri),
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
  return (result.days ?? []).map(normalizeMemoryPhoto);
}

export async function getDay(id: string): Promise<MemoryDay> {
  const result = await request<{ day: MemoryDay }>(
    `/api/days/${encodeURIComponent(id)}`
  );
  return normalizeMemoryPhoto(result.day);
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
  track: TrackInfo;
}): Promise<MemoryDay> {
  const { name, type } = detectPhotoMeta(input.photoUri, input.photoMimeType);

  if (Platform.OS !== 'web' && input.photoBase64) {
    const { body, contentType } = buildMultipartBody({
      text: input.text,
      track: input.track,
      photoBase64: input.photoBase64,
      photoName: name,
      photoType: type,
    });

    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: body as unknown as BodyInit,
      headers: { 'Content-Type': contentType },
    });
    return normalizeMemoryPhoto(result.day);
  }

  if (/^(?:file:|content:|blob:)/i.test(input.photoUri)) {
    const form = new FormData();
    form.append('text', input.text);
    form.append('track', JSON.stringify(input.track));

    if (Platform.OS === 'web' && input.photoUri.startsWith('blob:')) {
      const photo = await fetch(input.photoUri).then((response) => response.blob());
      form.append('photo', photo, name);
    } else {
      form.append('photo', {
        uri: input.photoUri,
        name,
        type,
      } as unknown as Blob);
    }

    const result = await request<{ day: MemoryDay }>('/api/days', {
      method: 'POST',
      body: form,
      headers: {},
    });
    return normalizeMemoryPhoto(result.day);
  }

  const result = await request<{ day: MemoryDay }>('/api/days', {
    method: 'POST',
    body: JSON.stringify({
      text: input.text,
      photoUri: input.photoUri,
      track: input.track,
    }),
  });
  return normalizeMemoryPhoto(result.day);
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
}