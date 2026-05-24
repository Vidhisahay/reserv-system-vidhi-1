import { NextResponse } from "next/server";

export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: string, status = 500, code?: string) {
  return NextResponse.json({ error, code }, { status });
}
