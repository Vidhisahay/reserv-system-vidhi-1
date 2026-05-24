"use client";

import { ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ApiError, createReservation } from "@/lib/api";
import type { ProductWithStock } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReservationDialogProps = {
  product: ProductWithStock;
};

function createClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function ReservationDialog({ product }: ReservationDialogProps) {
  const router = useRouter();
  const availableStock = useMemo(
    () => product.stock.filter((stock) => stock.available > 0),
    [product.stock],
  );
  const [open, setOpen] = useState(false);
  const [warehouseId, setWarehouseId] = useState(availableStock[0]?.warehouseId ?? "");
  const [quantity, setQuantity] = useState(1);
  const [idempotencyKey, setIdempotencyKey] = useState(createClientId);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedStock = availableStock.find(
    (stock) => stock.warehouseId === warehouseId,
  );
  const maxQuantity = selectedStock?.available ?? 0;

  useEffect(() => {
    if (!selectedStock && availableStock[0]) {
      setWarehouseId(availableStock[0].warehouseId);
    }
  }, [availableStock, selectedStock]);

  useEffect(() => {
    if (maxQuantity > 0 && quantity > maxQuantity) {
      setQuantity(maxQuantity);
    }
  }, [maxQuantity, quantity]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (nextOpen) {
      setWarehouseId(availableStock[0]?.warehouseId ?? "");
      setQuantity(1);
      setIdempotencyKey(createClientId());
      setError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!warehouseId || quantity < 1 || quantity > maxQuantity) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const reservation = await createReservation(
        {
          productId: product.id,
          warehouseId,
          quantity,
        },
        idempotencyKey,
      );

      router.push(`/reservations/${reservation.id}`);
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.status === 409) {
        setError("Not enough stock available");
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("Unable to create reservation");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button disabled={availableStock.length === 0} className="w-full">
          <ShoppingCart className="mr-2 h-4 w-4" />
          Reserve
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserve {product.name}</DialogTitle>
          <DialogDescription>
            {new Intl.NumberFormat("en-GB", {
              style: "currency",
              currency: "GBP",
            }).format(product.price)}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`warehouse-${product.id}`}>Warehouse</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger id={`warehouse-${product.id}`}>
                <SelectValue placeholder="Select warehouse" />
              </SelectTrigger>
              <SelectContent>
                {availableStock.map((stock) => (
                  <SelectItem key={stock.warehouseId} value={stock.warehouseId}>
                    {stock.warehouse.name} ({stock.available} available)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`quantity-${product.id}`}>Quantity</Label>
            <Input
              id={`quantity-${product.id}`}
              min={1}
              max={maxQuantity}
              type="number"
              value={quantity}
              onChange={(event) =>
                setQuantity(Number.parseInt(event.target.value, 10) || 1)
              }
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting || !warehouseId || maxQuantity === 0}
            >
              {isSubmitting ? "Reserving..." : "Reserve stock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
