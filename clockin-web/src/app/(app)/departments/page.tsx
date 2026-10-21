'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { FormField } from '@/components/common/FormField';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchField } from '@/components/common/SearchField';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { usePermissions } from '@/lib/use-permissions';
import type { DepartmentDetail, DepartmentSummary, Member, Paginated } from '@/types/api';

export default function DepartmentsPage() {
  const toast = useToast();
  const { can } = usePermissions();
  const canEdit = can('membership', 'edit');
  const canView = can('member', 'view');

  const [query, setQuery] = useState('');
  const debouncedQ = useDebouncedValue(query.trim());
  const [rows, setRows] = useState<DepartmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [rename, setRename] = useState('');
  const [archiveTarget, setArchiveTarget] = useState<DepartmentSummary | null>(null);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [addMembershipId, setAddMembershipId] = useState('');

  const load = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: 'active' });
      if (debouncedQ) params.set('q', debouncedQ);
      const res = await api<{ data: DepartmentSummary[] }>(
        `/departments?${params.toString()}`,
      );
      setRows(res.data ?? []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load departments'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [canView, debouncedQ, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await api<DepartmentDetail>(`/departments/${id}`);
      setDetail(res);
      setRename(res.name);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load department'));
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  useEffect(() => {
    if (!canEdit) return;
    api<Paginated<Member>>('/members?pageSize=100&status=active')
      .then((res) => setMembers(res.data ?? []))
      .catch(() => setMembers([]));
  }, [canEdit]);

  async function createDepartment(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const created = await api<DepartmentSummary>('/departments', {
        method: 'POST',
        body: { name: trimmed },
      });
      setCreating(false);
      setName('');
      await load();
      setSelectedId(created.id);
      toast.success('Department created');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not create department'));
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    if (!detail) return;
    const trimmed = rename.trim();
    if (!trimmed || trimmed === detail.name) return;
    setSaving(true);
    try {
      await api(`/departments/${detail.id}`, {
        method: 'PATCH',
        body: { name: trimmed },
      });
      await load();
      await loadDetail(detail.id);
      toast.success('Department renamed');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not rename department'));
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!archiveTarget) return;
    setSaving(true);
    try {
      await api(`/departments/${archiveTarget.id}`, {
        method: 'PATCH',
        body: { status: 'archived' },
      });
      if (selectedId === archiveTarget.id) setSelectedId(null);
      setArchiveTarget(null);
      await load();
      toast.success('Department archived');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not archive department'));
    } finally {
      setSaving(false);
    }
  }

  async function addPerson() {
    if (!detail || !addMembershipId) return;
    setSaving(true);
    try {
      await api(`/departments/${detail.id}/members`, {
        method: 'POST',
        body: { membershipId: addMembershipId },
      });
      setAddMembershipId('');
      await load();
      await loadDetail(detail.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add person'));
    } finally {
      setSaving(false);
    }
  }

  async function removePerson() {
    if (!detail || !removeTarget) return;
    setSaving(true);
    try {
      await api(`/departments/${detail.id}/members/${removeTarget}`, {
        method: 'DELETE',
      });
      setRemoveTarget(null);
      await load();
      await loadDetail(detail.id);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not remove person'));
    } finally {
      setSaving(false);
    }
  }

  const memberIds = new Set(detail?.members.map((m) => m.membershipId) ?? []);
  const addOptions = members.filter((m) => !memberIds.has(m.id));

  if (!canView) {
    return (
      <EmptyState
        title="No access"
        description="You need team access to view departments."
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Group people for reporting. A person can belong to more than one department."
        helpKey="departments"
        actions={
          canEdit ? (
            <Button type="button" onClick={() => setCreating(true)}>
              New department
            </Button>
          ) : null
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Search departments"
        />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No departments"
          description="Create a department, then add the people who belong to it."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="divide-y divide-navy/10 rounded-lg border border-border bg-card">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left ${
                    selectedId === row.id ? 'bg-coral/5' : 'hover:bg-paper'
                  }`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <span className="font-medium text-navy">{row.name}</span>
                  <span className="text-sm text-slate">
                    {row.memberCount} {row.memberCount === 1 ? 'person' : 'people'}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <section className="rounded-lg border border-border bg-card p-4">
            {!selectedId ? (
              <p className="text-sm text-slate">Select a department to see its people.</p>
            ) : detailLoading || !detail ? (
              <ListSkeleton />
            ) : (
              <div className="space-y-4">
                {canEdit ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <FormField label="Name" htmlFor="dept-rename" className="min-w-[200px] flex-1">
                      <Input
                        id="dept-rename"
                        value={rename}
                        onChange={(e) => setRename(e.target.value)}
                      />
                    </FormField>
                    <Button type="button" onClick={() => void saveName()} disabled={saving}>
                      Save name
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() =>
                        setArchiveTarget(
                          rows.find((row) => row.id === detail.id) ?? null,
                        )
                      }
                    >
                      Archive
                    </Button>
                  </div>
                ) : (
                  <h2 className="text-lg font-semibold text-navy">{detail.name}</h2>
                )}

                {canEdit ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <FormField label="Add person" htmlFor="dept-add" className="min-w-[200px] flex-1">
                      <Select
                        id="dept-add"
                        value={addMembershipId}
                        onChange={(e) => setAddMembershipId(e.target.value)}
                      >
                        <option value="">Choose a person</option>
                        {addOptions.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.user.name || member.user.email}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <Button
                      type="button"
                      onClick={() => void addPerson()}
                      disabled={!addMembershipId || saving}
                    >
                      Add
                    </Button>
                  </div>
                ) : null}

                {detail.members.length === 0 ? (
                  <p className="text-sm text-slate">No people in this department yet.</p>
                ) : (
                  <ul className="divide-y divide-navy/10">
                    {detail.members.map((member) => (
                      <li
                        key={member.membershipId}
                        className="flex items-center justify-between gap-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-navy">
                            {member.user.name || member.user.email}
                          </p>
                          <p className="text-xs text-slate">{member.user.email}</p>
                        </div>
                        {canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setRemoveTarget(member.membershipId)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <Modal
        open={creating}
        title="New department"
        onClose={() => setCreating(false)}
      >
        <form onSubmit={createDepartment} className="space-y-4">
          <FormField label="Name" htmlFor="dept-name" required>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Delivery"
              required
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive department?"
        description={
          archiveTarget
            ? `${archiveTarget.name} will drop out of reports and new assignments. People stay in the organisation.`
            : ''
        }
        confirmLabel="Archive"
        danger
        loading={saving}
        onConfirm={() => void archive()}
        onCancel={() => setArchiveTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="Remove from department?"
        description="They stay in the organisation and on their projects. They will no longer appear in this department's reports."
        confirmLabel="Remove"
        danger
        loading={saving}
        onConfirm={() => void removePerson()}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
