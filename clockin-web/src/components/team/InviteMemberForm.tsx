'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type {
  InviteMemberInput,
  Member,
  MemberType,
  OrgRole,
} from '@/types/api';

type InviteMemberFormProps = {
  managers: Member[];
  roles: OrgRole[];
  submitting: boolean;
  onSubmit: (values: InviteMemberInput) => Promise<void>;
  onCancel: () => void;
};

type FormState = {
  email: string;
  name: string;
  memberType: MemberType;
  department: string;
  managerId: string;
  roleIds: string[];
};

const EMPTY: FormState = {
  email: '',
  name: '',
  memberType: 'staff',
  department: '',
  managerId: '',
  roleIds: [],
};

/** FINAL FIX 9 — invites offer `member` only (no legacy `employee`). */
function inviteableRoles(roles: OrgRole[]): OrgRole[] {
  return roles.filter((r) => r.name.toLowerCase() === 'member');
}

export function InviteMemberForm({
  managers,
  roles,
  submitting,
  onSubmit,
  onCancel,
}: InviteMemberFormProps) {
  const memberRoles = useMemo(() => inviteableRoles(roles), [roles]);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<{ email?: string }>({});

  useEffect(() => {
    const defaultRole = memberRoles[0];
    setForm({
      ...EMPTY,
      roleIds: defaultRole ? [defaultRole.id] : [],
    });
    setErrors({});
  }, [memberRoles]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const email = form.email.trim().toLowerCase();
    const nextErrors: { email?: string } = {};
    if (!email || !email.includes('@')) {
      nextErrors.email = 'Enter a valid email address.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const memberRoleId = memberRoles[0]?.id;
    const payload: InviteMemberInput = {
      email,
      name: form.name.trim() || undefined,
      memberType: form.memberType,
      department: form.department.trim() || undefined,
      managerId: form.managerId || undefined,
      roleIds: memberRoleId ? [memberRoleId] : undefined,
    };
    await onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField label="Email" htmlFor="invite-email" error={errors.email}>
        <Input
          id="invite-email"
          type="email"
          value={form.email}
          onChange={(e) => setField('email', e.target.value)}
          placeholder="alex@company.com"
          invalid={Boolean(errors.email)}
          required
        />
      </FormField>

      <FormField label="Name" htmlFor="invite-name">
        <Input
          id="invite-name"
          value={form.name}
          onChange={(e) => setField('name', e.target.value)}
          placeholder="Alex Morgan"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Member type" htmlFor="invite-type">
          <Select
            id="invite-type"
            value={form.memberType}
            onChange={(e) =>
              setField('memberType', e.target.value as MemberType)
            }
          >
            <option value="staff">Staff</option>
            <option value="contractor">Contractor</option>
            <option value="client_contact">Client contact</option>
          </Select>
        </FormField>
        <FormField label="Department" htmlFor="invite-department">
          <Input
            id="invite-department"
            value={form.department}
            onChange={(e) => setField('department', e.target.value)}
            placeholder="Delivery"
          />
        </FormField>
      </div>

      <FormField
        label="Manager"
        htmlFor="invite-manager"
        hint="Optional — active membership"
      >
        <Select
          id="invite-manager"
          value={form.managerId}
          onChange={(e) => setField('managerId', e.target.value)}
        >
          <option value="">No manager</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.user.name || m.user.email}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        label="Role"
        htmlFor="invite-role"
        hint="New invites start as member. Promote later from Team edit."
      >
        {memberRoles.length === 0 ? (
          <p id="invite-role" className="text-sm text-slate">
            No member role found in this organisation — fix roles in seed, then
            invite again.
          </p>
        ) : (
          <p
            id="invite-role"
            className="rounded-xl bg-paper px-3 py-2 text-sm text-ink ring-1 ring-border/70"
          >
            {memberRoles[0].name}
          </p>
        )}
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
        <Button
          type="submit"
          loading={submitting}
          disabled={submitting || memberRoles.length === 0}
        >
          Send invite
        </Button>
      </div>
    </form>
  );
}
