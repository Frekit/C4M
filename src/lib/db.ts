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

function hasClientModel(instance: PrismaClient | undefined) {
  return (
    typeof (instance as { client?: { findMany?: unknown } } | undefined)?.client
      ?.findMany === "function"
  );
}

function runtimeDeliverableFields(instance: PrismaClient) {
  const models = (
    instance as {
      _runtimeDataModel?: {
        models?: Record<string, { fields?: Record<string, unknown> | Array<{ name: string }> }>;
      };
    }
  )._runtimeDataModel?.models;
  const model = models?.Deliverable ?? models?.deliverable;
  if (!model?.fields) return [];
  if (Array.isArray(model.fields)) return model.fields.map((field) => field.name);
  return Object.keys(model.fields);
}

function isStaleDeliverableClient(instance: PrismaClient | undefined) {
  if (!instance) return false;
  const fields = runtimeDeliverableFields(instance);
  if (fields.length === 0) return false;
  return !fields.includes("campaignId") || !fields.includes("postUrlKey");
}

if (process.env.NODE_ENV !== "production" && globalForPrisma.prisma) {
  const staleSchema = globalForPrisma.prismaSchemaSignature !== schemaSignature;
  if (
    staleSchema ||
    !hasClientModel(globalForPrisma.prisma) ||
    isStaleDeliverableClient(globalForPrisma.prisma)
  ) {
    void globalForPrisma.prisma.$disconnect();
    globalForPrisma.prisma = undefined;
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaSchemaSignature = schemaSignature;
}
