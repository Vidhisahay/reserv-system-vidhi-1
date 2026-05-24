"use client";

import { format, intervalToDuration } from "date-fns";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  confirmReservation,
  getReservation,
  releaseReservation,
} from "@/lib/api";
import type { ReservationWithDetails } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getRemainingMs(expiresAt: string) {
  return Math.max(0, new Date(expiresAt).getTime() - Date.now());
}

function formatCountdown(ms: number) {
  const duration = intervalToDuration({ start: 0, end: ms });
  const minutes = String(
    (duration.hours ?? 0) * 60 + (duration.minutes ?? 0),
  ).padStart(2, "0");
  const seconds = String(duration.seconds ?? 0).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function statusClassName(status: ReservationWithDetails["status"]) {
  if (status === "CONFIRMED") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "RELEASED") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

export default function ReservationPage() {
  const params = useParams<{ id: string }>();
  const reservationId = params.id;
  const [reservation, setReservation] = useState<ReservationWithDetails | null>(
    null,
  );
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [confirmIdempotencyKey] = useState(createClientId);
  const hasAutoReleased = useRef(false);

  const totalPrice = useMemo(() => {
    if (!reservation) {
      return 0;
    }

    return reservation.product.price * reservation.quantity;
  }, [reservation]);

  useEffect(() => {
    let isMounted = true;

    async function loadReservation() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getReservation(reservationId);
        if (isMounted) {
          setReservation(data);
          setRemainingMs(getRemainingMs(data.expiresAt));
        }
      } catch (caughtError) {
        if (isMounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to load reservation",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReservation();

    return () => {
      isMounted = false;
    };
  }, [reservationId]);

  useEffect(() => {
    if (!reservation) {
      return;
    }

    const timer = window.setInterval(() => {
      setRemainingMs(getRemainingMs(reservation.expiresAt));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reservation]);

  useEffect(() => {
    if (
      !reservation ||
      reservation.status !== "PENDING" ||
      remainingMs > 0 ||
      hasAutoReleased.current
    ) {
      return;
    }

    hasAutoReleased.current = true;
    const reservationToRelease = reservation;

    async function autoRelease() {
      try {
        const released = await releaseReservation(reservationToRelease.id);
        setReservation((current) =>
          current
            ? {
                ...current,
                ...released,
              }
            : current,
        );
      } catch (caughtError) {
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to release reservation",
        );
      }
    }

    autoRelease();
  }, [remainingMs, reservation]);

  async function handleConfirm() {
    if (!reservation) {
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const confirmed = await confirmReservation(
        reservation.id,
        confirmIdempotencyKey,
      );
      setReservation((current) =>
        current
          ? {
              ...current,
              ...confirmed,
            }
          : current,
      );
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 410) {
        setError("Reservation expired");
        setRemainingMs(0);
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("Unable to confirm reservation");
      }
    } finally {
      setIsConfirming(false);
    }
  }

  async function handleRelease() {
    if (!reservation) {
      return;
    }

    setIsReleasing(true);
    setError(null);

    try {
      const released = await releaseReservation(reservation.id);
      setReservation((current) =>
        current
          ? {
              ...current,
              ...released,
            }
          : current,
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to cancel reservation",
      );
    } finally {
      setIsReleasing(false);
    }
  }

  const canAct = reservation?.status === "PENDING" && remainingMs > 0;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Products
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Reservation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : null}

            {!isLoading && error && !reservation ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {reservation ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h1 className="text-2xl font-semibold tracking-normal">
                      {reservation.product.name}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {reservation.warehouse.name} - {reservation.warehouse.location}
                    </p>
                  </div>
                  <Badge className={statusClassName(reservation.status)}>
                    {reservation.status}
                  </Badge>
                </div>

                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-md border p-4">
                    <dt className="text-sm text-muted-foreground">Quantity</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {reservation.quantity}
                    </dd>
                  </div>
                  <div className="rounded-md border p-4">
                    <dt className="text-sm text-muted-foreground">Total</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {currency.format(totalPrice)}
                    </dd>
                  </div>
                  <div className="rounded-md border p-4">
                    <dt className="text-sm text-muted-foreground">Expires</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {format(new Date(reservation.expiresAt), "HH:mm")}
                    </dd>
                  </div>
                  <div className="rounded-md border p-4">
                    <dt className="text-sm text-muted-foreground">Countdown</dt>
                    <dd
                      className={
                        remainingMs === 0
                          ? "mt-1 text-xl font-semibold text-destructive"
                          : "mt-1 text-xl font-semibold text-primary"
                      }
                    >
                      {remainingMs === 0 ? "Expired" : formatCountdown(remainingMs)}
                    </dd>
                  </div>
                </dl>

                {error ? (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                {canAct ? (
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={isConfirming || isReleasing}
                      onClick={handleConfirm}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {isConfirming ? "Confirming..." : "Confirm Purchase"}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      disabled={isConfirming || isReleasing}
                      onClick={handleRelease}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      {isReleasing ? "Cancelling..." : "Cancel"}
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
