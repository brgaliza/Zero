import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  await db.projectReadiness.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
} finally {
  await db.$disconnect();
}
