import type { ApiError } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiRequestError extends Error {
  status: number;
  payload: ApiError;

  constructor(status: number, payload: ApiError) {
    super(payload.detail);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiError;
    try {
      payload = (await response.json()) as ApiError;
    } catch {
      payload = { detail: response.statusText };
    }
    throw new ApiRequestError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
