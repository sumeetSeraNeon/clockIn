'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Modal } from '@/components/common/Modal';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  downloadImportTemplate,
  parseImportFile,
  type ImportKind,
  type ParsedImportRow,
} from '@/lib/import-file';
import { cn } from '@/lib/cn';
import type {
  ClientImportRow,
  ImportClientLookup,
  ImportCommitResult,
  ImportPreviewResponse,
  ImportProjectLookup,
  ImportRowStatus,
  ImportSummary,
  ProjectImportRow,
  TaskImportRow,
} from '@/types/api';

type ImportModalProps = {
  open: boolean;
  kind: ImportKind;
  onClose: () => void;
  onImported: () => void;
};

type PreviewRow = ClientImportRow | ProjectImportRow | TaskImportRow;

type DraftRow = ParsedImportRow & {
  excluded?: boolean;
  clientId?: string | null;
  projectId?: string | null;
  createClient?: boolean;
  createProject?: boolean;
};

const KIND_LABEL: Record<ImportKind, string> = {
  clients: 'Clients',
  projects: 'Projects',
  tasks: 'Tasks',
};

const ENDPOINT: Record<ImportKind, string> = {
  clients: '/imports/clients',
  projects: '/imports/projects',
  tasks: '/imports/tasks',
};

function statusTone(status: ImportRowStatus): string {
  switch (status) {
    case 'create':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'skip':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'error':
      return 'bg-red-50 text-danger border-red-200';
    case 'excluded':
      return 'bg-amber-50 text-amber-800 border-amber-200';
  }
}

function statusLabel(status: ImportRowStatus): string {
  switch (status) {
    case 'create':
      return 'Create';
    case 'skip':
      return 'Skip';
    case 'error':
      return 'Error';
    case 'excluded':
      return 'Removed';
  }
}

function emptySummary(): ImportSummary {
  return { create: 0, skip: 0, error: 0, excluded: 0 };
}

/**
 * FIX 2 — upload → editable preview (live re-validate) → confirm → commit.
 * Never writes until Confirm; errored rows are skipped on commit.
 */
export function ImportModal({
  open,
  kind,
  onClose,
  onImported,
}: ImportModalProps) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewSeq = useRef(0);

  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState<ImportSummary>(emptySummary());
  const [clients, setClients] = useState<ImportClientLookup[]>([]);
  const [projects, setProjects] = useState<ImportProjectLookup[]>([]);
  const [canCreateClient, setCanCreateClient] = useState(false);
  const [canCreateProject, setCanCreateProject] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const reset = useCallback(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setDrafts([]);
    setPreviewRows([]);
    setSummary(emptySummary());
    setClients([]);
    setProjects([]);
    setCanCreateClient(false);
    setCanCreateProject(false);
    setParseError(null);
    setPreviewLoading(false);
    setConfirmOpen(false);
    setCommitting(false);
    setResult(null);
    setFileName(null);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const buildPayloadRows = useCallback(
    (rows: DraftRow[]) => {
      if (kind === 'clients') {
        return rows.map((r) => ({
          rowKey: r.rowKey,
          clientName: r.clientName ?? '',
          excluded: Boolean(r.excluded),
        }));
      }
      if (kind === 'projects') {
        return rows.map((r) => ({
          rowKey: r.rowKey,
          clientName: r.clientName ?? '',
          projectName: r.projectName ?? '',
          clientId: r.clientId || null,
          createClient: Boolean(r.createClient),
          excluded: Boolean(r.excluded),
        }));
      }
      return rows.map((r) => ({
        rowKey: r.rowKey,
        taskName: r.taskName ?? '',
        projectName: r.projectName ?? '',
        clientName: r.clientName ?? '',
        clientId: r.clientId || null,
        projectId: r.projectId || null,
        createClient: Boolean(r.createClient),
        createProject: Boolean(r.createProject),
        excluded: Boolean(r.excluded),
      }));
    },
    [kind],
  );

  const runPreview = useCallback(
    async (rows: DraftRow[], immediate = false) => {
      if (!rows.length) {
        setPreviewRows([]);
        setSummary(emptySummary());
        return;
      }

      const doFetch = async () => {
        const seq = ++previewSeq.current;
        setPreviewLoading(true);
        try {
          const body = { rows: buildPayloadRows(rows) };
          const res = await api<ImportPreviewResponse<PreviewRow>>(
            `${ENDPOINT[kind]}/preview`,
            { method: 'POST', body },
          );
          if (seq !== previewSeq.current) return;
          setPreviewRows(res.rows);
          setSummary(res.summary);
          setClients(res.lookups.clients ?? []);
          setProjects(res.lookups.projects ?? []);
          setCanCreateClient(Boolean(res.canCreateClient));
          setCanCreateProject(Boolean(res.canCreateProject));
        } catch (err) {
          if (seq !== previewSeq.current) return;
          toast.error(getErrorMessage(err, 'Could not validate import'));
        } finally {
          if (seq === previewSeq.current) setPreviewLoading(false);
        }
      };

      if (previewTimer.current) clearTimeout(previewTimer.current);
      if (immediate) {
        await doFetch();
      } else {
        previewTimer.current = setTimeout(() => {
          void doFetch();
        }, 280);
      }
    },
    [kind, toast, buildPayloadRows],
  );

  async function handleFile(file: File | null) {
    if (!file) return;
    setParseError(null);
    setResult(null);
    setFileName(file.name);
    try {
      const parsed = await parseImportFile(kind, file);
      const next: DraftRow[] = parsed.map((r) => ({ ...r }));
      setDrafts(next);
      await runPreview(next, true);
    } catch (err) {
      const message = getErrorMessage(err, 'Could not read file');
      reset();
      setParseError(message);
      setFileName(file.name);
    }
  }

  function updateDraft(rowKey: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => {
      const next = prev.map((r) =>
        r.rowKey === rowKey ? { ...r, ...patch } : r,
      );
      void runPreview(next);
      return next;
    });
  }

  function removeRow(rowKey: string) {
    updateDraft(rowKey, { excluded: true });
  }

  function restoreRow(rowKey: string) {
    updateDraft(rowKey, { excluded: false });
  }

  const previewByKey = useMemo(() => {
    const map = new Map<string, PreviewRow>();
    for (const row of previewRows) map.set(row.rowKey, row);
    return map;
  }, [previewRows]);

  const canCommit = summary.create > 0 && !previewLoading && !committing;

  async function handleCommit() {
    setCommitting(true);
    try {
      const body = { rows: buildPayloadRows(drafts) };
      const res = await api<ImportCommitResult>(`${ENDPOINT[kind]}/commit`, {
        method: 'POST',
        body,
      });
      setResult(res);
      setConfirmOpen(false);
      toast.success(res.message);
      onImported();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Import failed'));
    } finally {
      setCommitting(false);
    }
  }

  function handleClose() {
    if (committing) return;
    onClose();
  }

  const title = `Import ${KIND_LABEL[kind]}`;
  const hasPreview = drafts.length > 0 || Boolean(result);
  const modalSize = !hasPreview
    ? 'md'
    : kind === 'clients'
      ? 'lg'
      : kind === 'tasks'
        ? '2xl'
        : 'xl';

  return (
    <>
      <Modal
        open={open}
        title={title}
        description="Upload a CSV or Excel file, review the preview, then confirm. Only Create rows are written."
        onClose={handleClose}
        size={modalSize}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={committing}
            >
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result ? (
              <Button
                type="button"
                disabled={!canCommit}
                onClick={() => setConfirmOpen(true)}
              >
                Import {summary.create > 0 ? `(${summary.create})` : ''}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="shrink-0 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="sr-only"
              onChange={(e) => {
                void handleFile(e.target.files?.[0] ?? null);
              }}
            />
            <button
              type="button"
              disabled={committing}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'flex w-full flex-col items-start gap-1 rounded-lg border border-dashed border-navy/25 bg-navy/[0.02] px-4 py-3 text-left transition',
                'hover:border-coral/50 hover:bg-coral/[0.04]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral',
              )}
            >
              <span className="text-sm font-semibold text-navy">
                {fileName ? 'Replace file' : 'Upload file to import'}
              </span>
              <span className="text-xs text-slate">
                {fileName
                  ? fileName
                  : 'CSV or Excel (.xlsx). This is the file that will be imported.'}
              </span>
            </button>
            <p className="text-xs text-slate">
              Need the column layout?{' '}
              <button
                type="button"
                className="font-medium text-coral underline-offset-2 hover:underline"
                onClick={() => downloadImportTemplate(kind)}
              >
                Download template
              </button>
            </p>
          </div>

          {parseError ? (
            <p className="shrink-0 text-sm font-medium text-danger">
              {parseError}
            </p>
          ) : null}

          {result ? (
            <div className="shrink-0 border-b border-navy/15 pb-3 text-sm text-ink">
              <p className="font-medium">Import complete</p>
              <p className="mt-1 text-slate">{result.message}</p>
            </div>
          ) : null}

          {drafts.length > 0 && !result ? (
            <>
              <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs text-slate">
                <span>
                  {summary.create} create · {summary.skip} skip ·{' '}
                  {summary.error} error
                  {summary.excluded ? ` · ${summary.excluded} removed` : ''}
                </span>
                {previewLoading ? <span>Updating…</span> : null}
              </div>

              {summary.error > 0 ? (
                <p className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {summary.error}{' '}
                  {summary.error === 1 ? 'row needs' : 'rows need'} a fix —
                  correct the name
                  {kind === 'clients'
                    ? ''
                    : kind === 'projects'
                      ? ' or choose an existing client under Link to client'
                      : ' or choose an existing client / project in the link columns'}
                  .
                </p>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-navy/15">
                      <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                        Status
                      </th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                        {kind === 'clients' ? 'Client name' : 'Client'}
                      </th>
                      {kind !== 'clients' ? (
                        <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                          Project
                        </th>
                      ) : null}
                      {kind === 'tasks' ? (
                        <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                          Task
                        </th>
                      ) : null}
                      {kind === 'projects' || kind === 'tasks' ? (
                        <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                          Link to client
                        </th>
                      ) : null}
                      {kind === 'tasks' ? (
                        <th className="whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55">
                          Link to project
                        </th>
                      ) : null}
                      <th className="w-full whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-navy/55">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {drafts.map((draft) => {
                      const preview = previewByKey.get(draft.rowKey);
                      const status = preview?.status ?? 'error';
                      const reason = preview?.reason;
                      const isRemoved = Boolean(draft.excluded);
                      const fieldWidth = kind === 'tasks' ? 'w-36' : 'w-44';
                      const linkWidth = kind === 'tasks' ? 'w-44' : 'w-52';

                      return (
                        <tr
                          key={draft.rowKey}
                          className={cn(
                            'border-b border-navy/[0.08] align-middle transition-colors hover:bg-navy/[0.03]',
                            isRemoved && 'opacity-50',
                          )}
                        >
                          <td className="px-3 py-2.5 text-navy">
                            <span
                              className={cn(
                                'inline-flex rounded border px-2 py-0.5 text-xs font-medium',
                                statusTone(status),
                              )}
                            >
                              {statusLabel(status)}
                            </span>
                            {reason ? (
                              <p className="mt-1 max-w-[11rem] text-xs text-slate">
                                {reason}
                              </p>
                            ) : null}
                          </td>

                          <td className="px-3 py-2.5">
                            <div className={fieldWidth}>
                              <Input
                                className="py-1.5"
                                value={draft.clientName ?? ''}
                                disabled={isRemoved}
                                onChange={(e) =>
                                  updateDraft(draft.rowKey, {
                                    clientName: e.target.value,
                                    clientId: null,
                                    createClient: false,
                                    projectId: null,
                                    createProject: false,
                                  })
                                }
                              />
                            </div>
                          </td>

                          {kind !== 'clients' ? (
                            <td className="px-3 py-2.5">
                              <div className={fieldWidth}>
                                <Input
                                  className="py-1.5"
                                  value={draft.projectName ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      projectName: e.target.value,
                                      projectId: null,
                                      createProject: false,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          ) : null}

                          {kind === 'tasks' ? (
                            <td className="px-3 py-2.5">
                              <div className={fieldWidth}>
                                <Input
                                  className="py-1.5"
                                  value={draft.taskName ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      taskName: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          ) : null}

                          {kind === 'projects' || kind === 'tasks' ? (
                            <td className="px-3 py-2.5">
                              <div className={linkWidth}>
                                <Select
                                  className="py-1"
                                  disabled={isRemoved}
                                  value={
                                    draft.createClient
                                      ? '__create__'
                                      : (draft.clientId ?? '')
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '__create__') {
                                      updateDraft(draft.rowKey, {
                                        clientId: null,
                                        createClient: true,
                                        projectId: null,
                                        createProject: false,
                                      });
                                    } else if (!value) {
                                      updateDraft(draft.rowKey, {
                                        clientId: null,
                                        createClient: false,
                                        projectId: null,
                                        createProject: false,
                                      });
                                    } else {
                                      const c = clients.find(
                                        (x) => x.id === value,
                                      );
                                      updateDraft(draft.rowKey, {
                                        clientId: value,
                                        clientName:
                                          c?.name ?? draft.clientName,
                                        createClient: false,
                                        projectId: null,
                                        createProject: false,
                                      });
                                    }
                                  }}
                                >
                                  <option value="">Match by name…</option>
                                  {clients.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      Use existing: {c.name}
                                    </option>
                                  ))}
                                  {canCreateClient ? (
                                    <option value="__create__">
                                      Create this client too
                                    </option>
                                  ) : null}
                                </Select>
                              </div>
                              {draft.createClient ? (
                                <p className="mt-1 text-xs text-emerald-700">
                                  Will create client
                                </p>
                              ) : null}
                            </td>
                          ) : null}

                          {kind === 'tasks' ? (
                            <td className="px-3 py-2.5">
                              <div className={linkWidth}>
                                <Select
                                  className="py-1"
                                  disabled={isRemoved}
                                  value={
                                    draft.createProject
                                      ? '__create__'
                                      : (draft.projectId ?? '')
                                  }
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '__create__') {
                                      updateDraft(draft.rowKey, {
                                        projectId: null,
                                        createProject: true,
                                      });
                                    } else if (!value) {
                                      updateDraft(draft.rowKey, {
                                        projectId: null,
                                        createProject: false,
                                      });
                                    } else {
                                      const p = projects.find(
                                        (x) => x.id === value,
                                      );
                                      updateDraft(draft.rowKey, {
                                        projectId: value,
                                        projectName:
                                          p?.name ?? draft.projectName,
                                        clientId:
                                          p?.clientId ?? draft.clientId,
                                        clientName:
                                          p?.clientName ?? draft.clientName,
                                        createProject: false,
                                        createClient: false,
                                      });
                                    }
                                  }}
                                >
                                  <option value="">
                                    Match project by name…
                                  </option>
                                  {projects
                                    .filter((p) =>
                                      draft.clientId
                                        ? p.clientId === draft.clientId
                                        : true,
                                    )
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.clientName})
                                      </option>
                                    ))}
                                  {canCreateProject ? (
                                    <option value="__create__">
                                      Create this project too
                                    </option>
                                  ) : null}
                                </Select>
                              </div>
                              {draft.createProject ? (
                                <p className="mt-1 text-xs text-emerald-700">
                                  Will create project
                                </p>
                              ) : null}
                            </td>
                          ) : null}

                          <td className="w-full whitespace-nowrap px-3 py-2.5 text-right">
                            {isRemoved ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => restoreRow(draft.rowKey)}
                              >
                                Restore
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeRow(draft.rowKey)}
                              >
                                Remove
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={`Import ${summary.create} ${KIND_LABEL[kind].toLowerCase()}?`}
        description={`${summary.create} will be created, ${summary.skip} skipped, ${summary.error} errored (errored rows are not imported).`}
        confirmLabel="Import"
        loading={committing}
        onConfirm={() => {
          void handleCommit();
        }}
        onCancel={() => {
          if (!committing) setConfirmOpen(false);
        }}
      />
    </>
  );
}
