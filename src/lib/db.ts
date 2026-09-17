import { Prisma, PrismaClient } from "@prisma/client";

// Si Prisma se regenera con campos nuevos, el cliente cacheado en globalThis
// sigue validando el esquema viejo. Invalidamos al cambiar el DMMF.
const schemaSignature = Prisma.dmmf.datamodel.models
  .map(
    (model) =>
      `${model.name}:${model.fields.map((field) => field.name).join(",")}`
  )
  .join("|");

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaSignature?: string;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

if (
  process.env.NODE_ENV !== "production" &&
  globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaSignature !== schemaSignature
) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = schemaSignature;
}
