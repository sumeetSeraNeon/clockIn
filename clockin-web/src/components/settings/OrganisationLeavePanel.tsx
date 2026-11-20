'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Modal } from '@/components/common/Modal';
import { Pagination } from '@/components/common/Pagination';
import { SearchField } from '@/components/common/SearchField';
import { useToast } from '@/components/common/Toast';
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

type OrganisationLeavePanelProps = {
  yearMonth: string;
  /** When true, hide the outer month field (parent already shows one). */
  hideMonthControl?: boolean;
};

/**
 * Leave days for utilisation — Manage leave modal with search + pagination.
 */
export function OrganisationLeavePanel({
  yearMonth,
  hideMonthControl = false,
}: OrganisationLeavePanelProps) {
  const toast = useToast();
  const { me } = useAuth();
  const { highestRole } = usePermissions();
  const currentMembershipId = me?.membership?.id ?? null;
  const canEditAll = highestRole === 'owner' || highestRole === 'admin';
  const canEditManaged = highestRole === 'team_manager';

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMonth, setModalMonth] = useState(yearMonth);
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

  // Reset list state only when the modal opens.
  useEffect(() => {
    if (!modalOpen) return;
    setModalMonth(yearMonth);
    setPage(1);
    setNameQuery('');
    leaveMonthLoaded.current = null;
  }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps -- open only

  // Keep modal month in sync if parent month changes while closed.
  useEffect(() => {
    if (!modalOpen) setModalMonth(yearMonth);
  }, [yearMonth, modalOpen]);

  // Search / month change → back to page 1 (no extra wipe of rows).
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, modalMonth]);

  // Members page for current filters.
  useEffect(() => {
    if (!modalOpen) return;
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
  }, [modalOpen, modalMonth, page, debouncedQ]);

  // Leave map once per month while modal is open.
  useEffect(() => {
    if (!modalOpen) return;
    if (leaveMonthLoaded.current === modalMonth) return;
    let cancelled = false;

    async function loadLeave() {
      try {
        const leaveRes = await api<LeaveListResponse>(
          `/utilisation/leave?yearMonth=${encodeURIComponent(modalMonth)}`,
        );
        if (cancelled) return;
        const map: Record<string, number> = {};
        for (const e of leaveRes.entries ?? []) {
          map[e.userId] = e.leaveDays;
        }
        setLeaveByUserId(map);
        leaveMonthLoaded.current = modalMonth;
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
  }, [modalOpen, modalMonth]);

  function openEdit(member: Member) {
    setEditing(member);
    setDraftDays(String(leaveByUserId[member.userId] ?? 0));
  }

  function closeEdit() {
    if (saving) return;
    setEditing(null);
  }

  async function handleSave() {
    if (!editing) return;
    const next = Number(draftDays);
    if (!Number.isFinite(next) || next < 0) {
      toast.error('Enter leave days as a number ≥ 0');
      return;
    }
    const leaveDays = Math.round(next * 2) / 2;
    setSaving(true);
    try {
      await api(
        `/utilisation/leave/${editing.userId}?yearMonth=${modalMonth}`,
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
      setEditing(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save leave'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={
        hideMonthControl
          ? 'space-y-3'
          : 'flex flex-wrap items-end justify-between gap-3'
      }
    >
      <div className="min-w-0">
        {hideMonthControl ? (
          <p className="text-xs font-medium uppercase tracking-wide text-slate">
            Leave
          </p>
        ) : (
          <h3 className="text-sm font-semibold text-ink">Leave</h3>
        )}
        <p className="mt-0.5 text-sm text-slate">
          Days off for {formatDisplayYearMonth(yearMonth)} · Reports →
          Utilisation
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!hideMonthControl ? (
          <Input
            id="leave-month-summary"
            type="month"
            className="w-40"
            value={yearMonth}
            aria-label="Leave month"
            readOnly
          />
        ) : null}
        <Button type="button" size="sm" onClick={() => setModalOpen(true)}>
          Manage leave
        </Button>
      </div>

      <Modal
        open={modalOpen}
        size="2xl"
        title="Manage leave"
        description={`Leave for ${formatDisplayYearMonth(modalMonth)}. Search by name or email.`}
        onClose={() => {
          if (saving || editing) return;
          setModalOpen(false);
        }}
        className="min-h-[min(70vh,36rem)]"
      >
        <div className="flex min-h-[20rem] flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex w-44 shrink-0 flex-col gap-1 text-xs text-slate">
              Month
              <Input
                id="leave-modal-month"
                type="month"
                value={modalMonth}
                onChange={(e) => {
                  leaveMonthLoaded.current = null;
                  setModalMonth(e.target.value);
                }}
              />
            </label>
            <SearchField
              className="min-w-[16rem] max-w-none flex-1"
              value={nameQuery}
              onChange={setNameQuery}
              placeholder="Search name or email…"
            />
          </div>

          <div className="relative min-h-[16rem] flex-1">
            {loading && members.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate">Loading…</p>
            ) : members.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate">
                {debouncedQ
                  ? 'No matching people.'
                  : 'No active members to show.'}
              </p>
            ) : (
              <ul
                className={`divide-y divide-border/80 overflow-hidden rounded-lg border border-border/80 ${
                  loading ? 'opacity-60' : ''
                }`}
              >
                {members.map((row) => {
                  const days = leaveByUserId[row.userId] ?? 0;
                  const editable = canEditRow(row);
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-ink">
                          {row.user.name || row.user.email}
                        </p>
                        <p className="truncate text-xs text-slate">
                          {row.user.email}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="w-10 text-right tabular-nums text-navy">
                          {days === 0 ? '—' : `${days}d`}
                        </span>
                        {editable ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </Button>
                        ) : (
                          <span className="w-[3.25rem]" />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {totalPages > 1 ? (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          ) : total > 0 ? (
            <p className="text-xs text-slate">
              {total} {total === 1 ? 'person' : 'people'}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Edit leave"
        description={
          editing
            ? `Leave days for ${editing.user.name || editing.user.email} in ${formatDisplayYearMonth(modalMonth)}. Half days allowed.`
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
              loading={saving}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
          </div>
        }
      >
        <FormField label="Leave days" htmlFor="org-leave-days">
          <Input
            id="org-leave-days"
            type="number"
            min={0}
            step={0.5}
            value={draftDays}
            disabled={saving}
            onChange={(e) => setDraftDays(e.target.value)}
          />
        </FormField>
      </Modal>
    </div>
  );
}
