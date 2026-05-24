import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const warehouses = [
  { name: "London Hub", location: "London" },
  { name: "Manchester Depot", location: "Manchester" },
  { name: "Birmingham Store", location: "Birmingham" },
];

const products = [
  {
    name: "Wireless Headphones",
    description: "Noise-isolating wireless headphones with all-day battery life.",
    price: 79.99,
  },
  {
    name: "Mechanical Keyboard",
    description: "Tactile mechanical keyboard for focused desk setups.",
    price: 129.99,
  },
  {
    name: "USB-C Hub",
    description: "Compact USB-C hub with HDMI, USB-A, and power delivery.",
    price: 49.99,
  },
  {
    name: "Webcam HD",
    description: "High-definition webcam with crisp video for calls and streams.",
    price: 89.99,
  },
  {
    name: "Desk Lamp",
    description: "Adjustable LED desk lamp with warm and cool light modes.",
    price: 34.99,
  },
];

const stockQuantities = [
  [20, 2, 8],
  [4, 15, 1],
  [12, 6, 18],
  [1, 9, 5],
  [10, 3, 20],
];

async function main() {
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const createdWarehouses = await Promise.all(
    warehouses.map((warehouse) => prisma.warehouse.create({ data: warehouse })),
  );

  const createdProducts = await Promise.all(
    products.map((product) => prisma.product.create({ data: product })),
  );

  for (const [productIndex, product] of createdProducts.entries()) {
    for (const [warehouseIndex, warehouse] of createdWarehouses.entries()) {
      await prisma.stock.create({
        data: {
          productId: product.id,
          warehouseId: warehouse.id,
          total: stockQuantities[productIndex][warehouseIndex],
          reserved: 0,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
