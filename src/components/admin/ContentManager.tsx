"use client";
import { useState } from "react";
import { AdminApiError } from "@/lib/admin-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminTable } from "@/components/ui/AdminTable";
import { useToast } from "@/components/ui/Toast";
import { PublishPanel } from "@/components/admin/PublishPanel";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import {
  useBlocks,
  useUpsertBlock,
  type BlockRow,
} from "@/components/admin/useContentQueries";

// ---------------------------------------------------------------------------
// BlockFormModal
// ---------------------------------------------------------------------------

interface BlockFormModalProps {
  open: boolean;
  onClose: () => void;
  editRow?: BlockRow;
  onSaved: (key: string) => void;
}

function BlockFormModal({ open, onClose, editRow, onSaved }: BlockFormModalProps) {
  const toast = useToast();
  const upsert = useUpsertBlock();
  const isEdit = editRow !== undefined;

  const [key, setKey] = useState(editRow?.key ?? "");
  const [title, setTitle] = useState(editRow?.title ?? "");
  const [body, setBody] = useState(editRow?.body ?? "");

  // Reset form when modal opens with new data
  const [lastOpenState, setLastOpenState] = useState(false);
  if (open !== lastOpenState) {
    setLastOpenState(open);
    if (open) {
      setKey(editRow?.key ?? "");
      setTitle(editRow?.title ?? "");
      setBody(editRow?.body ?? "");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedKey = key.trim();
    const trimmedTitle = title.trim();
    upsert.mutate(
      { key: trimmedKey, title: trimmedTitle, body },
      {
        onSuccess: () => {
          toast({ title: "Saved", variant: "success" });
          onSaved(trimmedKey);
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit content block" : "New content block"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          disabled={isEdit}
          required={!isEdit}
          placeholder="e.g. hero-headline"
        />
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Hero headline"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text">Body</label>
          <RichTextEditor value={body} onChange={setBody} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={upsert.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={upsert.isPending}>
            {isEdit ? "Save changes" : "Create block"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ContentManager — top-level exported component
// ---------------------------------------------------------------------------

export function ContentManager({ isAdmin }: { isAdmin: boolean }) {
  const { data: blocks, isLoading, isError, refetch } = useBlocks();

  const [formOpen, setFormOpen] = useState(false);
  const [editRow, setEditRow] = useState<BlockRow | undefined>();
  const [selectedKey, setSelectedKey] = useState<string>("");

  function openCreate() {
    setEditRow(undefined);
    setSelectedKey("");
    setFormOpen(true);
  }

  function openEdit(row: BlockRow) {
    setEditRow(row);
    setSelectedKey(row.key);
    setFormOpen(true);
  }

  function handleSaved(key: string) {
    setSelectedKey(key);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Loading state */}
      {isLoading && (
        <div className="flex flex-col gap-2" aria-label="Loading content blocks">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <EmptyState
          title="Couldn't load content blocks"
          description="There was a problem fetching content blocks."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      )}

      {/* Loaded state */}
      {!isLoading && !isError && blocks !== undefined && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-text-muted">
              {blocks.length} block{blocks.length !== 1 ? "s" : ""}
            </p>
            <Button onClick={openCreate}>New block</Button>
          </div>

          <AdminTable
            rows={blocks}
            rowKey={(r) => r.key}
            emptyLabel="No content blocks yet"
            columns={[
              {
                header: "Key",
                cell: (row) => <code className="text-xs">{row.key}</code>,
              },
              {
                header: "Title",
                cell: (row) => row.title,
              },
              {
                header: "Updated",
                cell: (row) => new Date(row.updatedAt).toLocaleDateString(),
                className: "w-36",
              },
              {
                header: "Actions",
                cell: (row) => (
                  <Button variant="secondary" size="sm" onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                ),
                className: "w-24",
              },
            ]}
          />

          {selectedKey && (
            <PublishPanel
              entityType="content_block"
              entityKey={selectedKey}
              canRollback={isAdmin}
            />
          )}
        </>
      )}

      {/* Form modal (create or edit) */}
      <BlockFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editRow={editRow}
        onSaved={handleSaved}
      />
    </div>
  );
}
