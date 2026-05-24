import { Package } from "lucide-react";

import { ReservationDialog } from "@/components/reservation-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProductsWithStock } from "@/lib/products";
import type { ProductStock } from "@/types";

export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

function stockBadgeVariant(available: number) {
  if (available > 5) {
    return "success";
  }

  if (available > 0) {
    return "warning";
  }

  return "destructive";
}

function stockBadgeLabel(stock: ProductStock) {
  if (stock.available === 0) {
    return `${stock.warehouse.name}: Out of Stock`;
  }

  return `${stock.warehouse.name}: ${stock.available}`;
}

export default async function HomePage() {
  const products = await getProductsWithStock();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase text-primary">
              Retail stock
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal sm:text-4xl">
              Inventory Reservation System
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {products.length} products
          </p>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id} className="flex h-full flex-col overflow-hidden">
              <div className="flex h-28 items-center justify-center border-b bg-accent">
                <Package className="h-12 w-12 text-accent-foreground" />
              </div>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="leading-tight">{product.name}</CardTitle>
                  <p className="shrink-0 text-base font-semibold text-primary">
                    {currency.format(product.price)}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  {product.description}
                </p>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex flex-wrap gap-2">
                  {product.stock.map((stock) => (
                    <Badge
                      key={stock.id}
                      variant={stockBadgeVariant(stock.available)}
                    >
                      {stockBadgeLabel(stock)}
                    </Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <ReservationDialog product={product} />
              </CardFooter>
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
