"use client";
import { useState } from "react";
import { AdminApiError } from "@/lib/admin-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminTable } from "@/components/ui/AdminTable";
import { useToast } from "@/components/ui/Toast";
import { PublishPanel } from "@/components/admin/PublishPanel";
import {
  useOptions,
  useUpsertOption,
  useDeleteOption,
  useReorderOptions,
  type OptionRow,
} from "@/components/admin/useConfigQueries";

// ---------------------------------------------------------------------------
// OptionFormModal
// ---------------------------------------------------------------------------

interface OptionFormModalProps {
  open: boolean;
  onClose: () => void;
  namespace: string;
  editRow?: OptionRow;
}

function OptionFormModal({ open, onClose, namespace, editRow }: OptionFormModalProps) {
  const toast = useToast();
  const upsert = useUpsertOption(namespace);

  const isEdit = editRow !== undefined;

  const [key, setKey] = useState(editRow?.key ?? "");
  const [label, setLabel] = useState(editRow?.label ?? "");
  const [valueText, setValueText] = useState(
    editRow?.value !== undefined && editRow.value !== null
      ? JSON.stringify(editRow.value, null, 2)
      : "",
  );
  const [enabled, setEnabled] = useState(editRow?.enabled ?? true);
  const [jsonError, setJsonError] = useState<string | undefined>();

  // Reset form state when modal opens with new data
  const [lastOpenState, setLastOpenState] = useState<boolean>(false);
  if (open !== lastOpenState) {
    setLastOpenState(open);
    if (open) {
      setKey(editRow?.key ?? "");
      setLabel(editRow?.label ?? "");
      setValueText(
        editRow?.value !== undefined && editRow.value !== null
          ? JSON.stringify(editRow.value, null, 2)
          : "",
      );
      setEnabled(editRow?.enabled ?? true);
      setJsonError(undefined);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setJsonError(undefined);

    let parsedValue: unknown = undefined;
    if (valueText.trim() !== "") {
      try {
        parsedValue = JSON.parse(valueText);
      } catch {
        setJsonError("Invalid JSON — check your syntax and try again.");
        return;
      }
    }

    upsert.mutate(
      {
        namespace,
        key: isEdit ? editRow.key : key.trim(),
        label: label.trim(),
        value: parsedValue,
        sortOrder: editRow?.sortOrder,
        enabled,
      },
      {
        onSuccess: () => {
          toast({ title: "Saved", variant: "success" });
          onClose();
        },
        onError: (err) => {
          if (err instanceof AdminApiError) {
            toast({ title: err.message, variant: "danger" });
          } else {
            toast({ title: "An unexpected error occurred.", variant: "danger" });
          }
        },
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit option" : "Add option"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={isEdit}
          required={!isEdit}
          placeholder="e.g. home"
        />
        <Input
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          placeholder="e.g. Home"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Value (JSON, optional)</label>
          <textarea
            value={valueText}
            onChange={(e) => {
              setValueText(e.target.value);
              setJsonError(undefined);
            }}
            placeholder='e.g. "home" or {"icon":"home"}'
            className="min-h-24 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
            aria-describedby={jsonError ? "value-json-error" : undefined}
            aria-invalid={jsonError ? true : undefined}
          />
          {jsonError && (
            <p id="value-json-error" className="text-sm text-danger">
              {jsonError}
            </p>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Enabled
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={upsert.isPending}>
            {isEdit ? "Save changes" : "Add option"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// DeleteConfirmModal
// ---------------------------------------------------------------------------

interface DeleteConfirmModalProps {
  open: boolean;
  onClose: () => void;
  namespace: string;
  targetKey: string;
}

function DeleteConfirmModal({ open, onClose, namespace, targetKey }: DeleteConfirmModalProps) {
  const toast = useToast();
  const deleteOpt = useDeleteOption(namespace);

  function handleConfirm() {
    deleteOpt.mutate(targetKey, {
      onSuccess: () => {
        toast({ title: "Option deleted", variant: "success" });
        onClose();
      },
      onError: (err) => {
        if (err instanceof AdminApiError) {
          toast({ title: err.message, variant: "danger" });
        } else {
          toast({ title: "An unexpected error occurred.", variant: "danger" });
        }
      },
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Delete option">
      <p className="mb-6 text-sm text-text-muted">
        Are you sure you want to delete <span className="font-medium text-text">{targetKey}</span>?
        This cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="danger" loading={deleteOpt.isPending} onClick={handleConfirm}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// OrderCell — React component so hooks run at top-level
// ---------------------------------------------------------------------------

function OrderCell({
  row,
  rows,
  namespace,
}: {
  row: OptionRow;
  rows: OptionRow[];
  namespace: string;
}) {
  const toast = useToast();
  const reorder = useReorderOptions(namespace);

  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const idx = sorted.findIndex((r) => r.key === row.key);
  const isFirst = idx === 0;
  const isLast = idx === sorted.length - 1;

  function swapOrder(direction: "up" | "down") {
    const i = idx;
    const j = direction === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= sorted.length) return;
    const newOrder = sorted.map((r) => r.key);
    [newOrder[i], newOrder[j]] = [newOrder[j], newOrder[i]];
    reorder.mutate(newOrder, {
      onError: (err) => {
        if (err instanceof AdminApiError) {
          toast({ title: err.message, variant: "danger" });
        } else {
          toast({ title: "Reorder failed.", variant: "danger" });
        }
      },
    });
  }

  return (
    <span className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Move ${row.key} up`}
        disabled={isFirst || reorder.isPending}
        onClick={() => swapOrder("up")}
      >
        ↑
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Move ${row.key} down`}
        disabled={isLast || reorder.isPending}
        onClick={() => swapOrder("down")}
      >
        ↓
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// EnabledCell — React component so hooks run at top-level
// ---------------------------------------------------------------------------

function EnabledCell({ row, namespace }: { row: OptionRow; namespace: string }) {
  const toast = useToast();
  const upsert = useUpsertOption(namespace);

  function handleToggle() {
    upsert.mutate(
      {
        namespace,
        key: row.key,
        label: row.label,
        value: row.value,
        sortOrder: row.sortOrder,
        enabled: !row.enabled,
      },
      {
        onError: (err) => {
          if (err instanceof AdminApiError) {
            toast({ title: err.message, variant: "danger" });
          } else {
            toast({ title: "Toggle failed.", variant: "danger" });
          }
        },
      },
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Badge variant={row.enabled ? "success" : "neutral"}>
        {row.enabled ? "Enabled" : "Disabled"}
      </Badge>
      <Button variant="ghost" size="sm" onClick={handleToggle} disabled={upsert.isPending}>
        Toggle
      </Button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// OptionsTable — composes AdminTable with properly isolated row-action cells
// ---------------------------------------------------------------------------

interface OptionsTableProps {
  rows: OptionRow[];
  namespace: string;
  onEdit: (row: OptionRow) => void;
  onDelete: (key: string) => void;
}

function OptionsTable({ rows, namespace, onEdit, onDelete }: OptionsTableProps) {
  return (
    <AdminTable
      rows={rows}
      rowKey={(r) => r.key}
      emptyLabel="No options in this namespace yet"
      columns={[
        {
          header: "Order",
          cell: (row) => <OrderCell row={row} rows={rows} namespace={namespace} />,
          className: "w-24",
        },
        {
          header: "Key",
          cell: (row) => <code className="text-xs">{row.key}</code>,
        },
        {
          header: "Label",
          cell: (row) => row.label,
        },
        {
          header: "Enabled",
          cell: (row) => <EnabledCell row={row} namespace={namespace} />,
        },
        {
          header: "Actions",
          cell: (row) => (
            <span className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => onEdit(row)}>
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => onDelete(row.key)}>
                Delete
              </Button>
            </span>
          ),
          className: "w-40",
        },
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// OptionsManager — top-level exported component
// ---------------------------------------------------------------------------

export function OptionsManager({ isAdmin }: { isAdmin: boolean }) {
  const [namespaceInput, setNamespaceInput] = useState("nav");
  const [activeNamespace, setActiveNamespace] = useState("nav");

  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<OptionRow | undefined>();
  const [deleteKey, setDeleteKey] = useState<string | undefined>();

  const { data: rows, isLoading, isError, refetch } = useOptions(activeNamespace);

  function handleLoad() {
    const trimmed = namespaceInput.trim();
    if (trimmed) setActiveNamespace(trimmed);
  }

  function openCreate() {
    setEditRow(undefined);
    setFormOpen(true);
  }

  function openEdit(row: OptionRow) {
    setEditRow(row);
    setFormOpen(true);
  }

  function openDelete(key: string) {
    setDeleteKey(key);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Namespace picker */}
      <div className="flex items-end gap-3">
        <div className="w-64">
          <Input
            label="Namespace"
            value={namespaceInput}
            onChange={(e) => setNamespaceInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLoad();
            }}
            placeholder="e.g. nav"
          />
        </div>
        <Button variant="secondary" onClick={handleLoad}>
          Load
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-2" aria-label="Loading options">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <EmptyState
          title="Couldn't load options"
          description="There was a problem fetching options for this namespace."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Loaded state */}
      {!isLoading && !isError && rows !== undefined && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              Namespace: <span className="font-medium text-text">{activeNamespace}</span>
            </p>
            <Button onClick={openCreate}>Add option</Button>
          </div>

          <OptionsTable
            rows={rows}
            namespace={activeNamespace}
            onEdit={openEdit}
            onDelete={openDelete}
          />

          <PublishPanel
            entityType="options_namespace"
            entityKey={activeNamespace}
            canRollback={isAdmin}
          />
        </>
      )}

      {/* Form modal (create or edit) */}
      <OptionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        namespace={activeNamespace}
        editRow={editRow}
      />

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={deleteKey !== undefined}
        onClose={() => setDeleteKey(undefined)}
        namespace={activeNamespace}
        targetKey={deleteKey ?? ""}
      />
    </div>
  );
}
