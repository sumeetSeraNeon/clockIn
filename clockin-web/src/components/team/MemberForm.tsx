'use client';

import { FormEvent, useEffect, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type {
  DepartmentSummary,
  Member,
  MembershipStatus,
  OrgRole,
  UpdateMemberInput,
  UpdateMemberRolesInput,
} from '@/types/api';
import { api } from '@/lib/api-client';

export type MemberFormSubmit = {
  member: UpdateMemberInput;
  roles?: UpdateMemberRolesInput;
};

type MemberFormProps = {
  initial: Member;
  managers: Member[];
  roles: OrgRole[];
  submitting: boolean;
  onSubmit: (values: MemberFormSubmit) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  departmentIds: string[];
  managerId: string;
  status: MembershipStatus;
  roleIds: string[];
};

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export function MemberForm({
  initial,
  managers,
  roles,
  submitting,
  onSubmit,
  onCancel,
}: MemberFormProps) {
  const [form, setForm] = useState<FormState>({
    departmentIds: [],
    managerId: '',
    status: 'active',
    roleIds: [],
  });
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    api<{ data: DepartmentSummary[] }>('/departments?status=active')
      .then((res) => {
        if (!cancelled) setDepartments(res.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setDepartments([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setForm({
      departmentIds: initial.departments?.map((d) => d.id) ?? [],
      managerId: initial.managerId ?? '',
      status: (initial.status as MembershipStatus) || 'active',
      roleIds: initial.roles.map((r) => r.id),
    });
  }, [initial]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const currentRoleIds = new Set(initial.roles.map((r) => r.id));
    const nextRoleIds = new Set(form.roleIds);
    const addRoleIds = form.roleIds.filter((id) => !currentRoleIds.has(id));
    const removeRoleIds = initial.roles
      .map((r) => r.id)
      .filter((id) => !nextRoleIds.has(id));

    const member: UpdateMemberInput = {
      departmentIds: form.departmentIds,
      managerId: form.managerId || null,
      status: form.status,
    };

    const rolesPayload =
      addRoleIds.length || removeRoleIds.length
        ? {
            ...(addRoleIds.length ? { addRoleIds } : {}),
            ...(removeRoleIds.length ? { removeRoleIds } : {}),
          }
        : undefined;

    await onSubmit({ member, roles: rolesPayload });
  }

  const managerOptions = managers.filter((m) => m.id !== initial.id);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl bg-paper px-3.5 py-3 text-sm">
        <p className="font-medium text-ink">
          {initial.user.name || initial.user.email}
        </p>
        <p className="text-slate">{initial.user.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Departments" htmlFor="member-departments">
          <div id="member-departments" className="flex flex-col gap-2">
            {departments.length === 0 ? (
              <p className="text-sm text-slate">No departments yet.</p>
            ) : (
              departments.map((department) => (
                <label
                  key={department.id}
                  className="flex items-center gap-2 text-sm text-ink"
                >
                  <input
                    type="checkbox"
                    checked={form.departmentIds.includes(department.id)}
                    onChange={() =>
                      setField(
                        'departmentIds',
                        toggleId(form.departmentIds, department.id),
                      )
                    }
                    className="h-4 w-4 rounded border-border accent-coral"
                  />
                  {department.name}
                </label>
              ))
            )}
          </div>
        </FormField>
        <FormField label="Status" htmlFor="member-status">
          <Select
            id="member-status"
            value={form.status}
            onChange={(e) =>
              setField('status', e.target.value as MembershipStatus)
            }
          >
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
          </Select>
        </FormField>
      </div>

      <FormField label="Manager" htmlFor="member-manager">
        <Select
          id="member-manager"
          value={form.managerId}
          onChange={(e) => setField('managerId', e.target.value)}
        >
          <option value="">No manager</option>
          {managerOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.user.name || m.user.email}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Roles" htmlFor="member-roles">
        <div id="member-roles" className="flex flex-col gap-2">
          {roles.map((role) => (
            <label
              key={role.id}
              className="flex items-center gap-2 text-sm text-ink"
            >
              <input
                type="checkbox"
                checked={form.roleIds.includes(role.id)}
                onChange={() =>
                  setField('roleIds', toggleId(form.roleIds, role.id))
                }
                className="h-4 w-4 rounded border-border accent-coral"
              />
                  {role.name.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
