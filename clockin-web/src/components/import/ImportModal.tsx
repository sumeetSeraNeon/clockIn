'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
} from 'react';
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
  TicketImportRow,
} from '@/types/api';

type ImportModalProps = {
  open: boolean;
  kind: ImportKind;
  onClose: () => void;
  onImported: () => void;
};

type PreviewRow =
  | ClientImportRow
  | ProjectImportRow
  | TaskImportRow
  | TicketImportRow;

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
  tickets: 'Tickets',
};

const ENDPOINT: Record<ImportKind, string> = {
  clients: '/imports/clients',
  projects: '/imports/projects',
  tasks: '/imports/tasks',
  tickets: '/imports/tickets',
};

function statusTone(status: ImportRowStatus): string {
  switch (status) {
    case 'create':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'update':
      return 'bg-sky-50 text-sky-800 border-sky-200';
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
    case 'update':
      return 'Update';
    case 'skip':
      return 'Skip';
    case 'error':
      return 'Error';
    case 'excluded':
      return 'Removed';
  }
}

function emptySummary(): ImportSummary {
  return { create: 0, update: 0, skip: 0, error: 0, excluded: 0 };
}

/** Quiet inline field — avoids a wall of white bordered boxes in the preview. */
const cellFieldClass =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-sm text-navy outline-none transition placeholder:text-slate/45 hover:border-navy/15 hover:bg-card/70 focus:border-navy/25 focus:bg-card disabled:opacity-60';

function CellInput({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(cellFieldClass, className)} {...rest} />;
}

function CellSelect({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(cellFieldClass, 'pr-6', className)} {...rest}>
      {children}
    </select>
  );
}

function EditField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 block">
      <span className="text-[11px] font-medium uppercase tracking-wide text-navy/45">
        {label}
      </span>
      <CellInput
        className="mt-0.5 bg-paper/60 hover:bg-card focus:bg-card"
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function statusAccent(status: ImportRowStatus): string {
  switch (status) {
    case 'create':
      return 'border-l-emerald-400';
    case 'update':
      return 'border-l-sky-400';
    case 'skip':
      return 'border-l-slate-300';
    case 'error':
      return 'border-l-red-400';
    case 'excluded':
      return 'border-l-amber-400';
  }
}

function SummaryChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tone,
      )}
    >
      <span className="tabular-nums">{count}</span> {label}
    </span>
  );
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
  const [expandedTicketKeys, setExpandedTicketKeys] = useState<Set<string>>(
    () => new Set(),
  );

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
    setExpandedTicketKeys(new Set());
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
      if (kind === 'tickets') {
        return rows.map((r) => ({
          rowKey: r.rowKey,
          clientName: r.clientName ?? '',
          reference: r.reference ?? '',
          title: r.title ?? '',
          status: r.ticketStatus ?? '',
          priority: r.priority ?? null,
          ticketType: r.ticketType ?? '',
          agentName: r.agentName ?? null,
          groupName: r.groupName ?? null,
          openedAt: r.openedAt ?? null,
          dueAt: r.dueAt ?? null,
          resolvedAt: r.resolvedAt ?? null,
          closedAt: r.closedAt ?? null,
          initialResponseAt: r.initialResponseAt ?? null,
          firstResponseDuration: r.firstResponseDuration ?? null,
          resolutionDuration: r.resolutionDuration ?? null,
          tags: r.tags ?? null,
          internalAgentName: r.internalAgentName ?? null,
          ticketPriority: r.ticketPriority ?? null,
          workstream: r.workstream ?? null,
          contactName: r.contactName ?? null,
          contactEmail: r.contactEmail ?? null,
          contactExternalId: r.contactExternalId ?? null,
          source: r.source ?? null,
          clientId: r.clientId || null,
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

  const writableCount = summary.create + (summary.update ?? 0);
  const canCommit = writableCount > 0 && !previewLoading && !committing;

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
    : kind === 'tickets'
      ? 'full'
      : kind === 'clients'
        ? 'lg'
        : kind === 'tasks'
          ? '2xl'
          : 'xl';

  function toggleTicketExpand(rowKey: string) {
    setExpandedTicketKeys((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) next.delete(rowKey);
      else next.add(rowKey);
      return next;
    });
  }

  return (
    <>
      <Modal
        open={open}
        title={title}
        description={
          kind === 'tickets'
            ? hasPreview
              ? 'Review Create/Update rows, fix any errors, then confirm.'
              : 'Upload a Freshdesk CSV or Excel export to preview.'
            : 'Upload a CSV or Excel file, review the preview, then confirm. Only Create rows are written.'
        }
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
                Import {writableCount > 0 ? `(${writableCount})` : ''}
              </Button>
            ) : null}
          </>
        }
      >
        <div className="flex min-h-0 flex-col gap-3">
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
            {kind === 'tickets' && hasPreview && fileName ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-paper px-3.5 py-2.5">
                <p className="min-w-0 truncate text-sm text-navy">
                  <span className="text-xs font-medium uppercase tracking-wide text-navy/45">
                    File
                  </span>{' '}
                  <span className="font-medium">{fileName}</span>
                </p>
                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={committing}
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium text-coral underline-offset-2 hover:underline"
                  >
                    Replace file
                  </button>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate underline-offset-2 hover:underline"
                    onClick={() => downloadImportTemplate(kind)}
                  >
                    Template
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  disabled={committing}
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    'flex w-full flex-col items-start gap-1 rounded-xl border border-dashed border-navy/20 bg-paper px-4 py-3.5 text-left transition',
                    'hover:border-coral/45 hover:bg-coral-tint/40',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral',
                  )}
                >
                  <span className="text-sm font-semibold text-navy">
                    {fileName ? 'Replace file' : 'Upload file to import'}
                  </span>
                  <span className="text-xs text-slate">
                    {fileName
                      ? fileName
                      : 'CSV or Excel (.xlsx). Preview rows before you commit.'}
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
              </>
            )}
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
              <div className="flex shrink-0 flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <SummaryChip
                    label="create"
                    count={summary.create}
                    tone="border-emerald-200 bg-emerald-50 text-emerald-800"
                  />
                  <SummaryChip
                    label="update"
                    count={summary.update}
                    tone="border-sky-200 bg-sky-50 text-sky-800"
                  />
                  <SummaryChip
                    label="skip"
                    count={summary.skip}
                    tone="border-slate-200 bg-slate-100 text-slate-700"
                  />
                  <SummaryChip
                    label="error"
                    count={summary.error}
                    tone="border-red-200 bg-red-50 text-danger"
                  />
                  <SummaryChip
                    label="removed"
                    count={summary.excluded}
                    tone="border-amber-200 bg-amber-50 text-amber-800"
                  />
                  {previewLoading ? (
                    <span className="text-xs text-slate">Updating…</span>
                  ) : null}
                </div>
                {kind === 'tickets' ? (
                  <p className="text-xs text-slate">
                    Review each row, fix anything marked Error, then import.
                    Update means that Ticket ID already exists in ClockIn.
                  </p>
                ) : null}
              </div>

              {summary.error > 0 ? (
                <p className="shrink-0 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
                  {summary.error}{' '}
                  {summary.error === 1 ? 'row needs' : 'rows need'} a fix —
                  {kind === 'tickets'
                    ? ' match an existing client (or fix Type/Status), then try again'
                    : kind === 'clients'
                      ? ' correct the name'
                      : kind === 'projects'
                        ? ' correct the name or choose an existing client under Link to client'
                        : ' correct the name or choose an existing client / project in the link columns'}
                  .
                </p>
              ) : null}

              <div
                className={cn(
                  kind === 'tickets'
                    ? 'import-scroll max-h-[min(55vh,32rem)] rounded-xl border border-navy/10 bg-paper/80'
                    : 'overflow-x-auto',
                )}
              >
                {kind === 'tickets' ? (
                  <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
                    <colgroup>
                      <col className="w-[5.5rem]" />
                      <col className="w-[6.5rem]" />
                      <col />
                      <col className="w-[10rem]" />
                      <col className="w-[7rem]" />
                      <col className="w-[7.5rem]" />
                      <col className="w-[5.5rem]" />
                      <col className="w-[8rem]" />
                      <col className="w-[8.5rem]" />
                    </colgroup>
                    <thead>
                      <tr className="sticky top-0 z-10 border-b border-navy/10 bg-paper">
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Import
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Ticket ID
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Subject
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Client
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Type
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Status
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Priority
                        </th>
                        <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Group
                        </th>
                        <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-navy/50">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drafts.map((draft, rowIndex) => {
                        const preview = previewByKey.get(draft.rowKey) as
                          | TicketImportRow
                          | undefined;
                        const status = preview?.status ?? 'error';
                        const reason = preview?.reason;
                        const isRemoved = Boolean(draft.excluded);
                        const expanded = expandedTicketKeys.has(draft.rowKey);
                        return (
                          <Fragment key={draft.rowKey}>
                            <tr
                              className={cn(
                                'border-b border-navy/[0.06] border-l-4 align-top transition-colors',
                                statusAccent(status),
                                rowIndex % 2 === 0
                                  ? 'bg-card/40'
                                  : 'bg-transparent',
                                'hover:bg-card/80',
                                isRemoved && 'opacity-45',
                              )}
                            >
                              <td className="px-3 py-2.5">
                                <span
                                  className={cn(
                                    'inline-flex rounded-full border px-2 py-0.5 text-xs font-medium',
                                    statusTone(status),
                                  )}
                                >
                                  {statusLabel(status)}
                                </span>
                                {reason ? (
                                  <p className="mt-1 max-w-[6.5rem] text-xs leading-snug text-slate">
                                    {reason}
                                  </p>
                                ) : null}
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  className="min-w-[5rem] font-medium"
                                  value={draft.reference ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      reference: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  className="min-w-[10rem]"
                                  value={draft.title ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      title: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2">
                                <div className="space-y-0.5">
                                  <CellInput
                                    value={draft.clientName ?? ''}
                                    disabled={isRemoved}
                                    onChange={(e) =>
                                      updateDraft(draft.rowKey, {
                                        clientName: e.target.value,
                                        clientId: null,
                                      })
                                    }
                                  />
                                  <CellSelect
                                    value={draft.clientId ?? ''}
                                    disabled={isRemoved}
                                    onChange={(e) =>
                                      updateDraft(draft.rowKey, {
                                        clientId: e.target.value || null,
                                      })
                                    }
                                  >
                                    <option value="">Match by name</option>
                                    {clients.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </CellSelect>
                                </div>
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  value={draft.ticketType ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      ticketType: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  value={draft.ticketStatus ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      ticketStatus: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  value={draft.priority ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      priority: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2">
                                <CellInput
                                  value={draft.groupName ?? ''}
                                  disabled={isRemoved}
                                  onChange={(e) =>
                                    updateDraft(draft.rowKey, {
                                      groupName: e.target.value,
                                    })
                                  }
                                />
                              </td>
                              <td className="px-2 py-2 text-right">
                                <div className="flex flex-wrap justify-end gap-0.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      toggleTicketExpand(draft.rowKey)
                                    }
                                  >
                                    {expanded ? 'Less' : 'More'}
                                  </Button>
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
                                </div>
                              </td>
                            </tr>
                            {expanded ? (
                              <tr
                                className={cn(
                                  'border-b border-navy/[0.06] border-l-4',
                                  statusAccent(status),
                                  isRemoved && 'opacity-45',
                                )}
                              >
                                <td
                                  colSpan={9}
                                  className="bg-navy/[0.03] px-4 py-3.5"
                                >
                                  <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-navy/45">
                                    Extra fields
                                  </p>
                                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    <EditField
                                      label="Ticket priority"
                                      value={draft.ticketPriority}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          ticketPriority: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Agent"
                                      value={draft.agentName}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          agentName: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Internal agent"
                                      value={draft.internalAgentName}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          internalAgentName: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Source"
                                      value={draft.source}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          source: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Workstream"
                                      value={draft.workstream}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          workstream: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Tags"
                                      value={draft.tags}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, { tags: v })
                                      }
                                    />
                                    <EditField
                                      label="Created"
                                      value={draft.openedAt}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          openedAt: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Due"
                                      value={draft.dueAt}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, { dueAt: v })
                                      }
                                    />
                                    <EditField
                                      label="Resolved"
                                      value={draft.resolvedAt}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          resolvedAt: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Closed"
                                      value={draft.closedAt}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          closedAt: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Initial response"
                                      value={draft.initialResponseAt}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          initialResponseAt: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="First response"
                                      value={draft.firstResponseDuration}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          firstResponseDuration: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Resolution"
                                      value={draft.resolutionDuration}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          resolutionDuration: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Full name"
                                      value={draft.contactName}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          contactName: v,
                                        })
                                      }
                                    />
                                    <EditField
                                      label="Contact email"
                                      value={draft.contactEmail}
                                      disabled={isRemoved}
                                      onChange={(v) =>
                                        updateDraft(draft.rowKey, {
                                          contactEmail: v,
                                        })
                                      }
                                    />
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
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
                )}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title={`Import ${writableCount} ${KIND_LABEL[kind].toLowerCase()}?`}
        description={
          kind === 'tickets'
            ? `${summary.create} will be created, ${summary.update ?? 0} updated, ${summary.skip} skipped, ${summary.error} errored (errored rows are not imported).`
            : `${summary.create} will be created, ${summary.skip} skipped, ${summary.error} errored (errored rows are not imported).`
        }
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
