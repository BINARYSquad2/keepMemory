import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { MemoryDay, TrackInfo } from '../types/memory';

const TOKEN_KEY = 'keepmemory.authToken';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const API_URL =
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

async function request<T>(
  path: string,
  init: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body != null) {
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
      `Не удалось подключиться к Go API по адресу ${API_URL}.${detail}`
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Go API вернул невалидный JSON (HTTP ${response.status}).`);
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
  const result = await request<{ days: MemoryDay[] }>('/api/days');
  return result.days;
}

export async function getDay(id: string): Promise<MemoryDay> {
  const result = await request<{ day: MemoryDay }>(
    `/api/days/${encodeURIComponent(id)}`
  );
  return result.day;
}

export async function searchTracks(query: string): Promise<TrackInfo[]> {
  const result = await request<{ tracks: TrackInfo[] }>(
    `/api/tracks/search?q=${encodeURIComponent(query)}`
  );
  return result.tracks;
}

export async function createDay(input: {
  text: string;
  photoUri: string;
  track: TrackInfo;
}): Promise<MemoryDay> {
  const result = await request<{ day: MemoryDay }>('/api/days', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return result.day;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Произошла неизвестная ошибка.';
}
