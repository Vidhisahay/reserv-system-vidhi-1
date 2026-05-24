import type {
  ProductWithStock,
  Reservation,
  ReservationWithDetails,
  Warehouse,
} from "@/types";
import type { CreateReservationInput } from "./schemas";

type ApiErrorBody = {
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function getBaseUrl() {
  if (typeof window !== "undefined") {
    return "";
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let body: ApiErrorBody = {};
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = {};
    }

    throw new ApiError(
      response.status,
      body.error ?? "Request failed",
      body.code,
    );
  }

  return response.json() as Promise<T>;
}

export function getProducts(): Promise<ProductWithStock[]> {
  return apiFetch<ProductWithStock[]>("/api/products");
}

export function getWarehouses(): Promise<Warehouse[]> {
  return apiFetch<Warehouse[]>("/api/warehouses");
}

export function getReservation(id: string): Promise<ReservationWithDetails> {
  return apiFetch<ReservationWithDetails>(`/api/reservations/${id}`);
}

export function createReservation(
  data: CreateReservationInput,
  idempotencyKey?: string,
): Promise<Reservation> {
  return apiFetch<Reservation>("/api/reservations", {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    body: JSON.stringify(data),
  });
}

export function confirmReservation(
  id: string,
  idempotencyKey?: string,
): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/confirm`, {
    method: "POST",
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
}

export function releaseReservation(id: string): Promise<Reservation> {
  return apiFetch<Reservation>(`/api/reservations/${id}/release`, {
    method: "POST",
  });
}
