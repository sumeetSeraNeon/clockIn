'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FormField } from '@/components/common/FormField';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { SearchField } from '@/components/common/SearchField';
import { useToast } from '@/components/common/Toast';
import { ImportModal } from '@/components/import/ImportModal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth-context';
import { api, isAbortError } from '@/lib/api-client';
import { formatDisplayYearMonth } from '@/lib/date-range';
import { getErrorMessage } from '@/lib/get-error-message';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePermissions } from '@/lib/use-permissions';
import type { LeaveListResponse, Member, Paginated } from '@/types/api';

const PAGE_SIZE = 15;

type LeavePeoplePanelProps = {
  yearMonth: string;
  /** When true, hide the month field (parent already shows one). */
  hideMonthControl?: boolean;
  /** Called when the panel’s month changes (only if hideMonthControl is false). */
  onYearMonthChange?: (yearMonth: string) => void;
};

/**
 * Leave days for utilisation — inline searchable, paginated people list.
 */
export function LeavePeoplePanel({
  yearMonth,
  hideMonthControl = false,
  onYearMonthChange,
}: LeavePeoplePanelProps) {
  const toast = useToast();
  const { me } = useAuth();
  const { highestRole } = usePermissions();
  const currentMembershipId = me?.membership?.id ?? null;
  const canEditAll = highestRole === 'owner' || highestRole === 'admin';
  const canEditManaged = highestRole === 'team_manager';
  const canImport = canEditAll || canEditManaged;

  const [importOpen, setImportOpen] = useState(false);
  const [leaveReloadKey, setLeaveReloadKey] = useState(0);
  const [page, setPage] = useState(1);
  const [nameQuery, setNameQuery] = useState('');
  const debouncedQ = useDebouncedValue(nameQuery.trim(), 400);

  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [leaveByUserId, setLeaveByUserId] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const leaveMonthLoaded = useRef<string | null>(null);

  const [editing, setEditing] = useState<Member | null>(null);
  const [draftDays, setDraftDays] = useState('0');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canEditRow = useCallback(
    (member: Member) => {
      if (member.status !== 'active') return false;
      if (canEditAll) return true;
      if (canEditManaged && member.managerId === currentMembershipId) {
        return true;
      }
      return false;
    },
    [canEditAll, canEditManaged, currentMembershipId],
  );

  // Parent month change → reload leave map.
  useEffect(() => {
    leaveMonthLoaded.current = null;
    setPage(1);
  }, [yearMonth]);

  // Search / month change → back to page 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  // Members page for current filters.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadMembers() {
      const hadRows = members.length > 0;
      if (!hadRows) setLoading(true);
      try {
        const params = new URLSearchParams({
          status: 'active',
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (debouncedQ) params.set('q', debouncedQ);
        const membersRes = await api<Paginated<Member>>(
          `/members?${params.toString()}`,
          { signal: controller.signal },
        );
        if (cancelled) return;
        setMembers(membersRes.data ?? []);
        setTotal(membersRes.pagination?.total ?? 0);
        setTotalPages(membersRes.pagination?.totalPages ?? 0);
      } catch (err) {
        if (cancelled || isAbortError(err)) return;
        setMembers([]);
        setTotal(0);
        setTotalPages(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadMembers();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // members.length intentionally omitted — only gates initial loading flag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearMonth, page, debouncedQ]);

  // Leave map once per month (or after import).
  useEffect(() => {
    if (leaveReloadKey === 0 && leaveMonthLoaded.current === yearMonth) return;
    let cancelled = false;

    async function loadLeave() {
      try {
        const leaveRes = await api<LeaveListResponse>(
          `/utilisation/leave?yearMonth=${encodeURIComponent(yearMonth)}`,
        );
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const e of leaveRes.entries ?? []) {
          map[e.userId] = e.leaveDays;
        }
        setLeaveByUserId(map);
        leaveMonthLoaded.current = yearMonth;
      } catch {
        if (!cancelled) {
          setLeaveByUserId({});
          leaveMonthLoaded.current = null;
        }
      }
    }

    void loadLeave();
    return () => {
      cancelled = true;
    };
  }, [yearMonth, leaveReloadKey]);

  function openEdit(member: Member) {
    setEditing(member);
    setDraftDays(String(leaveByUserId[member.userId] ?? 0));
    setConfirmOpen(false);
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
    setConfirmOpen(false);
  }

  function requestSave() {
    if (!editing) return;
    const next = Number(draftDays);
    if (!Number.isFinite(next) || next < 0) {
      toast.error('Enter leave days as a number ≥ 0');
      return;
    }
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    if (!editing) return;
    const next = Number(draftDays);
    if (!Number.isFinite(next) || next < 0) {
      toast.error('Enter leave days as a number ≥ 0');
      setConfirmOpen(false);
      return;
    }
    const leaveDays = Math.round(next * 2) / 2;
    setSaving(true);
    try {
      await api(
        `/utilisation/leave/${editing.userId}?yearMonth=${yearMonth}`,
        {
          method: 'PUT',
          body: { leaveDays },
        },
      );
      setLeaveByUserId((prev) => ({
        ...prev,
        [editing.userId]: leaveDays,
      }));
      toast.success(
        `Leave updated for ${editing.user.name || editing.user.email}`,
      );
      setConfirmOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save leave'));
    } finally {
      setSaving(false);
    }
  }

  const personLabel = editing
    ? editing.user.name || editing.user.email
    : '';

  const fullMonthLabel = (() => {
    const [y, m] = yearMonth.slice(0, 7).split('-');
    const year = Number(y);
    const month = Number(m);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1) {
      return formatDisplayYearMonth(yearMonth);
    }
    return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className="max-w-3xl space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="pb-1.5 text-sm font-medium text-ink">
          People leave —{' '}
          <span className="font-semibold text-coral">{fullMonthLabel}</span>
        </p>
        <div className="flex flex-wrap items-end gap-2">
          {!hideMonthControl ? (
            <label className="flex w-36 flex-col gap-1 text-xs text-slate">
              Month
              <Input
                id="leave-people-month"
                type="month"
                value={yearMonth}
                onChange={(e) => onYearMonthChange?.(e.target.value)}
              />
            </label>
          ) : null}
          {canImport ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              Import
            </Button>
          ) : null}
          <SearchField
            className="w-56 max-w-full sm:w-64"
            value={nameQuery}
            onChange={setNameQuery}
            placeholder="Search name or email…"
          />
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-lg border border-border/80">
        {loading && members.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">Loading…</p>
        ) : members.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">
            {debouncedQ
              ? 'No matching people.'
              : 'No active members to show.'}
          </p>
        ) : (
          <table
            className={`w-full table-fixed border-collapse text-sm ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <thead>
              <tr className="border-b border-border/80 bg-paper text-left text-xs font-medium uppercase tracking-wide text-slate">
                <th className="w-[35%] px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="w-14 px-3 py-2 text-right font-medium">
                  Days
                </th>
                <th className="w-[4.5rem] px-3 py-2 text-right font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {members.map((row) => {
                const days = leaveByUserId[row.userId] ?? 0;
                const editable = canEditRow(row);
                return (
                  <tr key={row.id} className="hover:bg-paper/60">
                    <td className="truncate px-3 py-2 font-medium text-ink">
                      {row.user.name || row.user.email}
                    </td>
                    <td className="truncate px-3 py-2 text-slate">
                      {row.user.email}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy">
                      {days === 0 ? '—' : days}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {editable ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {total > 0 ? (
          <p className="text-xs text-slate">
            {total} {total === 1 ? 'person' : 'people'}
          </p>
        ) : (
          <span />
        )}
        {totalPages > 1 ? (
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      <Modal
        open={Boolean(editing) && !confirmOpen}
        title="Edit leave"
        description={
          editing
            ? `Leave days for ${personLabel} in ${formatDisplayYearMonth(yearMonth)}. Half days allowed.`
            : undefined
        }
        onClose={closeEdit}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={closeEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={requestSave}
            >
              Save
            </Button>
          </div>
        }
      >
        <FormField label="Leave days" htmlFor="leave-days">
          <Input
            id="leave-days"
            type="text"
            inputMode="decimal"
            value={draftDays}
            disabled={saving}
            onChange={(e) => setDraftDays(e.target.value)}
          />
        </FormField>
      </Modal>

      <ConfirmDialog
        open={confirmOpen && Boolean(editing)}
        title="Save leave days?"
        description={
          editing
            ? `Update leave for ${personLabel} in ${formatDisplayYearMonth(yearMonth)} to ${draftDays} day(s). This affects utilisation reports.`
            : ''
        }
        confirmLabel="Save leave"
        loading={saving}
        onConfirm={() => void handleConfirmSave()}
        onCancel={() => {
          if (!saving) setConfirmOpen(false);
        }}
      />

      <ImportModal
        open={importOpen && canImport}
        kind="leave"
        yearMonth={yearMonth}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          leaveMonthLoaded.current = null;
          setLeaveReloadKey((k) => k + 1);
        }}
      />
    </div>
  );
}
