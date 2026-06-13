"use client";
import { useState } from "react";
import { AdminApiError } from "@/lib/admin-client";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { AdminTable } from "@/components/ui/AdminTable";
import { useToast } from "@/components/ui/Toast";
import {
  useVersions,
  usePublish,
  useRollback,
  type EntityType,
  type VersionRow,
} from "@/components/admin/usePublishQueries";

// ---------------------------------------------------------------------------
// RollbackModal
// ---------------------------------------------------------------------------

interface RollbackModalProps {
  open: boolean;
  onClose: () => void;
  version: number;
  entityType: EntityType;
  entityKey: string;
}

function RollbackModal({ open, onClose, version, entityType, entityKey }: RollbackModalProps) {
  const toast = useToast();
  const rollback = useRollback(entityType, entityKey);

  function handleRollback() {
    rollback.mutate(version, {
      onSuccess: () => {
        toast({
          title: `Rolled back to v${version} — now a draft. Publish to go live.`,
          variant: "success",
        });
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
    <Modal open={open} onClose={onClose} title={`Roll back to v${version}?`}>
      <p className="mb-6 text-sm text-text-muted">
        This restores version <span className="font-medium text-text">v{version}</span> into the
        working copy as a draft. Re-publish to make it live.
      </p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={rollback.isPending}>
          Cancel
        </Button>
        <Button variant="danger" loading={rollback.isPending} onClick={handleRollback}>
          Roll back
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// PublishPanel
// ---------------------------------------------------------------------------

export function PublishPanel({
  entityType,
  entityKey,
  canRollback,
}: {
  entityType: EntityType;
  entityKey: string;
  canRollback: boolean;
}) {
  const toast = useToast();
  const publish = usePublish(entityType, entityKey);
  const { data: versions, isLoading } = useVersions(entityType, entityKey);

  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);

  if (!entityKey) return null;

  function handlePublish() {
    publish.mutate(undefined, {
      onSuccess: (data) => {
        toast({ title: `Published v${data.version}`, variant: "success" });
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

  const columns: { header: string; cell: (row: VersionRow) => React.ReactNode; className?: string }[] = [
    {
      header: "Version",
      cell: (row) => <code className="text-xs">v{row.version}</code>,
      className: "w-24",
    },
    {
      header: "Published by",
      cell: (row) => row.publishedBy,
    },
    {
      header: "When",
      cell: (row) => new Date(row.publishedAt).toLocaleString(),
    },
    ...(canRollback
      ? [
          {
            header: "Actions",
            cell: (row: VersionRow) => (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRollbackVersion(row.version)}
              >
                Roll back
              </Button>
            ),
            className: "w-32",
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-lg border border-border bg-surface-raised p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text">Publishing</h3>
        <Button loading={publish.isPending} onClick={handlePublish}>
          Publish
        </Button>
      </div>

      {/* Version history */}
      {isLoading ? (
        <div className="flex flex-col gap-2" aria-label="Loading version history">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !versions || versions.length === 0 ? (
        <EmptyState
          title="Not published yet"
          description="Publish to create the first version."
        />
      ) : (
        <AdminTable
          rows={versions}
          rowKey={(r) => String(r.version)}
          emptyLabel="No versions yet"
          columns={columns}
        />
      )}

      {/* Rollback confirm modal */}
      {rollbackVersion !== null && (
        <RollbackModal
          open={rollbackVersion !== null}
          onClose={() => setRollbackVersion(null)}
          version={rollbackVersion}
          entityType={entityType}
          entityKey={entityKey}
        />
      )}
    </div>
  );
}
