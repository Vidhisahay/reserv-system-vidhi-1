export type ReservationStatus = "PENDING" | "CONFIRMED" | "RELEASED";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string | null;
  createdAt: string;
}

export interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export interface Stock {
  id: string;
  productId: string;
  warehouseId: string;
  total: number;
  reserved: number;
}

export interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  idempotencyKey: string | null;
}

export type ProductStock = Stock & {
  warehouse: Warehouse;
  available: number;
};

export type ProductWithStock = Product & {
  stock: ProductStock[];
};

export type ReservationWithDetails = Reservation & {
  product: Product;
  warehouse: Warehouse;
};
