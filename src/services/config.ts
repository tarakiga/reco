import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configOptions, configVersions, type ConfigOptionRow, type ConfigVersionRow } from "@/db/schema";
import { writeAudit } from "./audit";
import { publishedOption } from "@/lib/contracts/config";
import type { PublishedOption, ReorderInput, UpsertOptionInput } from "@/lib/contracts/config";

export async function listOptions(namespace: string): Promise<ConfigOptionRow[]> {
  return db
    .select()
    .from(configOptions)
    .where(eq(configOptions.namespace, namespace))
    .orderBy(asc(configOptions.sortOrder), asc(configOptions.key));
}

export async function upsertOption(input: UpsertOptionInput, actor: string) {
  const values = {
    namespace: input.namespace,
    key: input.key,
    label: input.label,
    value: input.value ?? null,
    sortOrder: input.sortOrder ?? 0,
    enabled: input.enabled ?? true,
    updatedBy: actor,
    updatedAt: new Date(),
  };
  await db
    .insert(configOptions)
    .values(values)
    .onConflictDoUpdate({
      target: [configOptions.namespace, configOptions.key],
      set: {
        label: values.label,
        value: values.value,
        sortOrder: values.sortOrder,
        enabled: values.enabled,
        updatedBy: actor,
        updatedAt: values.updatedAt,
      },
    });
  await writeAudit({
    actor,
    action: "option.upsert",
    entityType: "options_namespace",
    entityKey: input.namespace,
    detail: { key: input.key },
  });
}

export async function deleteOption(namespace: string, key: string, actor: string) {
  await db
    .delete(configOptions)
    .where(and(eq(configOptions.namespace, namespace), eq(configOptions.key, key)));
  await writeAudit({
    actor,
    action: "option.delete",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { key },
  });
}

export async function reorderOptions(input: ReorderInput, actor: string) {
  const existing = await listOptions(input.namespace);
  const existingKeys = existing.map((r) => r.key).sort();
  const orderedSorted = [...input.orderedKeys].sort();
  if (
    existingKeys.length !== orderedSorted.length ||
    existingKeys.some((k, i) => k !== orderedSorted[i])
  ) {
    throw new Error("orderedKeys must be a permutation of the namespace's keys");
  }
  for (let i = 0; i < input.orderedKeys.length; i++) {
    await db
      .update(configOptions)
      .set({ sortOrder: i, updatedBy: actor, updatedAt: new Date() })
      .where(
        and(
          eq(configOptions.namespace, input.namespace),
          eq(configOptions.key, input.orderedKeys[i]),
        ),
      );
  }
  await writeAudit({
    actor,
    action: "option.reorder",
    entityType: "options_namespace",
    entityKey: input.namespace,
    detail: { orderedKeys: input.orderedKeys },
  });
}

export async function publishOptionsNamespace(namespace: string, actor: string): Promise<number> {
  const rows = await listOptions(namespace);
  if (rows.length === 0) {
    throw new Error(`Cannot publish empty namespace "${namespace}"`);
  }
  const snapshot: PublishedOption[] = rows.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.value ?? null,
    sortOrder: r.sortOrder,
    enabled: r.enabled,
  }));
  const latest = await latestVersion("options_namespace", namespace);
  const version = (latest?.version ?? 0) + 1;
  await db.insert(configVersions).values({
    entityType: "options_namespace",
    entityKey: namespace,
    version,
    snapshot,
    publishedBy: actor,
  });
  await writeAudit({
    actor,
    action: "namespace.publish",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { version },
  });
  return version;
}

async function latestVersion(
  entityType: "options_namespace" | "content_block",
  entityKey: string,
): Promise<ConfigVersionRow | undefined> {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(and(eq(configVersions.entityType, entityType), eq(configVersions.entityKey, entityKey)))
    .orderBy(desc(configVersions.version))
    .limit(1);
  return row;
}

export async function getPublishedOptions(
  namespace: string,
): Promise<{ version: number; options: PublishedOption[] } | null> {
  const row = await latestVersion("options_namespace", namespace);
  if (!row) return null;
  const options = publishedOption.array().parse(row.snapshot);
  return { version: row.version, options };
}

export async function listVersions(
  entityType: "options_namespace" | "content_block",
  entityKey: string,
) {
  return db
    .select({
      version: configVersions.version,
      publishedBy: configVersions.publishedBy,
      publishedAt: configVersions.publishedAt,
    })
    .from(configVersions)
    .where(and(eq(configVersions.entityType, entityType), eq(configVersions.entityKey, entityKey)))
    .orderBy(desc(configVersions.version));
}

export async function rollbackOptionsNamespace(namespace: string, version: number, actor: string) {
  const [row] = await db
    .select()
    .from(configVersions)
    .where(
      and(
        eq(configVersions.entityType, "options_namespace"),
        eq(configVersions.entityKey, namespace),
        eq(configVersions.version, version),
      ),
    );
  if (!row) throw new Error(`No version ${version} for namespace "${namespace}"`);
  const options = publishedOption.array().parse(row.snapshot);
  // Wrap delete + insert in a transaction so a failed insert doesn't leave the
  // working copy wiped. The audit write is intentionally outside the transaction.
  if (options.length > 0) {
    await db.transaction(async (tx) => {
      await tx.delete(configOptions).where(eq(configOptions.namespace, namespace));
      await tx.insert(configOptions).values(
        options.map((o) => ({
          namespace,
          key: o.key,
          label: o.label,
          value: o.value ?? null,
          sortOrder: o.sortOrder,
          enabled: o.enabled,
          updatedBy: actor,
          updatedAt: new Date(),
        })),
      );
    });
  } else {
    await db.delete(configOptions).where(eq(configOptions.namespace, namespace));
  }
  await writeAudit({
    actor,
    action: "namespace.rollback",
    entityType: "options_namespace",
    entityKey: namespace,
    detail: { restoredVersion: version },
  });
}
