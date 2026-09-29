'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { InviteMemberForm } from '@/components/team/InviteMemberForm';
import {
  MemberForm,
  type MemberFormSubmit,
} from '@/components/team/MemberForm';
import { MembersTable } from '@/components/team/MembersTable';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import { useMembers } from '@/lib/use-members';
import { usePermissions } from '@/lib/use-permissions';
import type {
  InviteMemberInput,
  Member,
  MembershipStatus,
  OrgRole,
  Paginated,
} from '@/types/api';

type StatusFilter = MembershipStatus | 'all';
type ModalMode = 'invite' | 'edit' | null;

/**
 * Team — flat list of people. Manager column shows line manager.
 */
export default function TeamPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { can, scopeFor } = usePermissions();
  const canEdit = can('membership', 'edit');
  const memberViewScope = scopeFor('member', 'view');
  const showManagerFilter = memberViewScope === 'all';
  const currentMembershipId = me?.membership?.id ?? null;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [managerFilter, setManagerFilter] = useState<string>('all');
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deactivating, setDeactivating] = useState<Member | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [inviteResetLink, setInviteResetLink] = useState<string | null>(null);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useMembers({ page, pageSize: 20, status });

  const loadLookups = useCallback(async () => {
    try {
      const res = await api<Paginated<Member>>('/members?pageSize=100');
      setAllMembers(res.data ?? []);
    } catch {
      setAllMembers([]);
    }
  }, []);

  const [availableRoles, setAvailableRoles] = useState<OrgRole[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      const roles = await api<OrgRole[]>('/roles');
      setAvailableRoles(roles ?? []);
    } catch {
      setAvailableRoles([]);
    }
  }, []);

  useEffect(() => {
    void loadLookups();
    void loadRoles();
  }, [loadLookups, loadRoles]);

  const membersById = useMemo(() => {
    const map = new Map<string, Member>();
    for (const m of allMembers) map.set(m.id, m);
    for (const m of data) map.set(m.id, m);
    return map;
  }, [allMembers, data]);

  const activeManagers = useMemo(
    () => allMembers.filter((m) => m.status === 'active'),
    [allMembers],
  );

  const managerOptions = useMemo(() => {
    const opts: { id: string; label: string }[] = [];
    const seen = new Set<string>();
    for (const m of allMembers) {
      if (!m.managerId || seen.has(m.managerId)) continue;
      seen.add(m.managerId);
      const manager = membersById.get(m.managerId);
      opts.push({
        id: m.managerId,
        label: manager?.user.name || manager?.user.email || 'Manager',
      });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label));
  }, [allMembers, membersById]);

  const displayMembers = useMemo(() => {
    let list = [...data];
    if (showManagerFilter && managerFilter !== 'all') {
      if (managerFilter === 'none') {
        list = list.filter((m) => !m.managerId);
      } else {
        list = list.filter((m) => m.managerId === managerFilter);
      }
    }
    const personName = (m: Member) =>
      (m.user.name || m.user.email || '').toLowerCase();
    const managerName = (m: Member) => {
      if (!m.managerId) return '\uffff';
      const mgr = membersById.get(m.managerId);
      return (mgr?.user.name || mgr?.user.email || '').toLowerCase();
    };
    list.sort((a, b) => {
      const byMgr = managerName(a).localeCompare(managerName(b));
      if (byMgr !== 0) return byMgr;
      return personName(a).localeCompare(personName(b));
    });
    return list;
  }, [data, showManagerFilter, managerFilter, membersById]);

  const openInvite = useCallback(() => {
    setEditing(null);
    setModalMode('invite');
  }, []);

  const openEdit = useCallback((member: Member) => {
    setEditing(member);
    setModalMode('edit');
  }, []);

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalMode(null);
    setEditing(null);
  }, [submitting]);

  async function handleInvite(values: InviteMemberInput) {
    setSubmitting(true);
    setInviteResetLink(null);
    try {
      const created = await api<Member>('/members/invite', {
        method: 'POST',
        body: values,
      });
      toast.success(
        created.inviteEmailSent
          ? 'Invite email sent'
          : created.passwordResetLink
            ? 'Invite created — share the password link so they can set a password'
            : 'Invite created — they can sign in once their account is active',
      );
      if (created.passwordResetLink && !created.inviteEmailSent) {
        setInviteResetLink(created.passwordResetLink);
      } else {
        setModalMode(null);
      }
      reload();
      void loadLookups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not invite member'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(member: Member) {
    setApprovingId(member.id);
    try {
      await api<Member>(`/members/${member.id}/approve`, { method: 'POST' });
      toast.success(
        `Approved ${member.user.name || member.user.email} — they can sign in now`,
      );
      reload();
      void loadLookups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not approve member'));
    } finally {
      setApprovingId(null);
    }
  }

  async function handleEditSubmit(values: MemberFormSubmit) {
    if (!editing) return;
    setSubmitting(true);
    try {
      await api<Member>(`/members/${editing.id}`, {
        method: 'PATCH',
        body: values.member,
      });
      if (values.roles) {
        await api<Member>(`/members/${editing.id}/roles`, {
          method: 'POST',
          body: values.roles,
        });
      }
      toast.success('Member updated');
      setModalMode(null);
      setEditing(null);
      reload();
      void loadLookups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update member'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivating) return;
    setDeactivateLoading(true);
    try {
      await api(`/members/${deactivating.id}`, { method: 'DELETE' });
      toast.success(
        `Deactivated ${deactivating.user.name || deactivating.user.email}`,
      );
      setDeactivating(null);
      reload();
      void loadLookups();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not deactivate member'));
    } finally {
      setDeactivateLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Team"
        description={
          showManagerFilter
            ? 'People in the organisation. The Manager column is their line manager.'
            : 'People on your managed team — invites, roles, and status.'
        }
        actions={
          canEdit ? (
            <Button type="button" onClick={openInvite}>
              Invite member
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate">
          Status
          <Select
            className="w-44"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as StatusFilter);
            }}
          >
            <option value="all">All</option>
            <option value="pending">Pending approval</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </Select>
        </label>
        {showManagerFilter ? (
          <label className="flex items-center gap-2 text-sm text-slate">
            Manager
            <Select
              className="min-w-[180px]"
              value={managerFilter}
              onChange={(e) => {
                setPage(1);
                setManagerFilter(e.target.value);
              }}
            >
              <option value="all">All managers</option>
              <option value="none">No line manager</option>
              {managerOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </div>

      {loading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <div className="rounded-lg border border-border/80 bg-card px-5 py-6">
          <p className="text-sm font-medium text-danger">{error}</p>
          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={reload}
          >
            Try again
          </Button>
        </div>
      ) : displayMembers.length === 0 ? (
        <EmptyState
          title={
            status === 'all' && managerFilter === 'all'
              ? 'No team members to show'
              : 'No members match'
          }
          description={
            canEdit
              ? 'Invite someone, or wait for access requests from the login page.'
              : status === 'all' && managerFilter === 'all'
                ? 'You only see people on your managed team (or yourself).'
                : 'Nothing matches this filter.'
          }
          actionLabel={canEdit ? 'Invite member' : undefined}
          onAction={canEdit ? openInvite : undefined}
        />
      ) : (
        <>
          <MembersTable
            members={displayMembers}
            membersById={membersById}
            canEdit={canEdit}
            currentMembershipId={currentMembershipId}
            approvingId={approvingId}
            onEdit={openEdit}
            onApprove={(m) => void handleApprove(m)}
            onDeactivate={setDeactivating}
          />
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </>
      )}

      <Modal
        open={modalMode === 'invite'}
        title="Invite member"
        description="Creates the org membership and a Firebase login when possible. Share the password-reset link (no email sending yet)."
        onClose={() => {
          if (submitting) return;
          setModalMode(null);
          setEditing(null);
          setInviteResetLink(null);
        }}
      >
        {inviteResetLink ? (
          <div className="space-y-4">
            <p className="text-sm text-slate">
              Copy this link and send it to the invitee so they can set a
              password. They can sign in after that (admin invites are
              pre-approved).
            </p>
            <textarea
              readOnly
              className="h-28 w-full rounded-xl border border-border bg-paper px-3 py-2 text-xs text-ink"
              value={inviteResetLink}
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(inviteResetLink);
                    toast.success('Link copied');
                  } catch {
                    toast.error('Could not copy — select the link manually');
                  }
                }}
              >
                Copy link
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setModalMode(null);
                  setInviteResetLink(null);
                }}
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <InviteMemberForm
            managers={activeManagers}
            roles={availableRoles}
            submitting={submitting}
            onSubmit={handleInvite}
            onCancel={closeModal}
          />
        )}
      </Modal>

      <Modal
        open={modalMode === 'edit' && Boolean(editing)}
        title="Edit member"
        description="Update department, manager, status, and roles."
        onClose={closeModal}
      >
        {editing ? (
          <MemberForm
            initial={editing}
            managers={activeManagers}
            roles={availableRoles}
            submitting={submitting}
            onSubmit={handleEditSubmit}
            onCancel={closeModal}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deactivating)}
        title="Deactivate member?"
        description={
          deactivating
            ? `${deactivating.user.name || deactivating.user.email} will lose access on their next request. You cannot deactivate yourself.`
            : ''
        }
        confirmLabel="Deactivate"
        danger
        loading={deactivateLoading}
        onConfirm={() => void handleDeactivate()}
        onCancel={() => {
          if (!deactivateLoading) setDeactivating(null);
        }}
      />
    </div>
  );
}
