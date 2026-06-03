/**
 * Seed a dev user so you can log in immediately:
 *   email:    dev@flowcap.local
 *   password: flowcap123
 * Idempotent — safe to run repeatedly.
 */
import { PrismaClient, StorageProvider } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("flowcap123", 12);
  const user = await prisma.user.upsert({
    where: { email: "dev@flowcap.local" },
    update: {},
    create: { email: "dev@flowcap.local", name: "Dev User", passwordHash },
  });

  await prisma.storageConnection.upsert({
    where: { userId_provider: { userId: user.id, provider: StorageProvider.FLOWCAP } },
    update: {},
    create: { userId: user.id, provider: StorageProvider.FLOWCAP, isActive: true, isDefault: true },
  });

  // eslint-disable-next-line no-console
  console.log(`Seeded dev user ${user.email} (${user.id})`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
