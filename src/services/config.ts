import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { configOptions, type ConfigOptionRow } from "@/db/schema";
import { writeAudit } from "./audit";
import type { ReorderInput, UpsertOptionInput } from "@/lib/contracts/config";

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
