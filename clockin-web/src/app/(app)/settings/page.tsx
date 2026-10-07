'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { ensureCurrencyOption } from '@/lib/currencies';
import { getFirebaseAuth } from '@/lib/firebase';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notification-prefs';
import { COMMON_TIMEZONES, ensureTimezoneOption } from '@/lib/timezones';
import { usePermissions } from '@/lib/use-permissions';
import type { MeResponse, UpdateMeInput } from '@/types/api';

type SettingsTab = 'account' | 'security' | 'notifications' | 'organisation';

type OrganisationSettings = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
};

/**
 * Personal Settings (everyone) + Organisation currency (rate:edit).
 * Tabbed panels — Account / Security / Notifications / Organisation.
 */
export default function SettingsPage() {
  const toast = useToast();
  const { me, refreshMe, changePassword } = useAuth();
  const { can } = usePermissions();
  const canEditOrg = can('rate', 'edit');

  const [tab, setTab] = useState<SettingsTab>('account');
  const [name, setName] = useState(me?.user.name ?? '');
  const [timezone, setTimezone] = useState(
    ensureTimezoneOption(me?.user.timezone),
  );
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [notifyPrefs, setNotifyPrefs] = useState<NotificationPrefs>({
    emailApprovals: true,
    emailDigest: false,
  });

  const [currency, setCurrency] = useState(
    ensureCurrencyOption(me?.organisation?.currency),
  );
  const [savingOrg, setSavingOrg] = useState(false);

  useEffect(() => {
    setName(me?.user.name ?? '');
    setTimezone(ensureTimezoneOption(me?.user.timezone));
    setCurrency(ensureCurrencyOption(me?.organisation?.currency));
    if (me?.user.id) {
      setNotifyPrefs(loadNotificationPrefs(me.user.id));
    }
  }, [
    me?.user.id,
    me?.user.name,
    me?.user.timezone,
    me?.organisation?.currency,
  ]);

  async function handleSaveProfile(event?: FormEvent) {
    event?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Enter a display name');
      return;
    }
    setSavingProfile(true);
    try {
      const body: UpdateMeInput = {
        name: trimmed,
        timezone: timezone || null,
      };
      await api<MeResponse>('/me', { method: 'PATCH', body });
      const fbUser = getFirebaseAuth().currentUser;
      if (fbUser) {
        await updateProfile(fbUser, { displayName: trimmed }).catch(
          () => undefined,
        );
      }
      await refreshMe();
      toast.success('Account updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save account'));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(event?: FormEvent) {
    event?.preventDefault();
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update password'));
    } finally {
      setSavingPassword(false);
    }
  }

  function handleNotifyChange(next: NotificationPrefs) {
    setNotifyPrefs(next);
    if (me?.user.id) {
      saveNotificationPrefs(me.user.id, next);
      toast.success('Notification preferences saved');
    }
  }

  async function handleSaveOrg(event?: FormEvent) {
    event?.preventDefault();
    if (!canEditOrg) return;
    setSavingOrg(true);
    try {
      const res = await api<OrganisationSettings>('/organisation', {
        method: 'PATCH',
        body: { currency: currency.toUpperCase() },
      });
      await refreshMe();
      toast.success(`Default currency set to ${res.currency}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save organisation settings'));
    } finally {
      setSavingOrg(false);
    }
  }

  const orgName = me?.organisation?.name ?? 'Organisation';
  const email = me?.user.email ?? '—';

  const tabs = useMemo(() => {
    const list: { id: SettingsTab; label: string }[] = [
      { id: 'account', label: 'Account' },
      { id: 'security', label: 'Security' },
      { id: 'notifications', label: 'Notifications' },
    ];
    if (canEditOrg) {
      list.push({ id: 'organisation', label: 'Organisation' });
    }
    return list;
  }, [canEditOrg]);

  useEffect(() => {
    if (tab === 'organisation' && !canEditOrg) {
      setTab('account');
    }
  }, [tab, canEditOrg]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, and organisation defaults when you manage them."
        helpKey="settings"
      />

      <div className="inline-flex flex-wrap rounded-md border border-border/80 bg-paper p-0.5">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              tab === id
                ? 'bg-card text-ink shadow-sm'
                : 'text-slate hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'account' ? (
        <section className="space-y-4">
          <p className="text-sm text-slate">How you appear in ClockIn.</p>
          <form
            onSubmit={(e) => void handleSaveProfile(e)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Display name" htmlFor="me-name">
                <Input
                  id="me-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={savingProfile}
                  autoComplete="name"
                />
              </FormField>

              <FormField label="Timezone" htmlFor="me-timezone">
                <Select
                  id="me-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={savingProfile}
                >
                  <option value="">Use browser default</option>
                  {timezone &&
                  !(COMMON_TIMEZONES as readonly string[]).includes(
                    timezone,
                  ) ? (
                    <option value={timezone}>{timezone}</option>
                  ) : null}
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, ' ')}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-slate">
                  Preference for how dates appear later. Does not change stored
                  hours or approvals.
                </p>
              </FormField>

              <div>
                <p className="text-sm font-medium text-navy">Email</p>
                <p className="mt-1 text-sm text-ink">{email}</p>
                <p className="mt-1 text-xs text-slate">
                  From your sign-in account — not editable here.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              loading={savingProfile}
              disabled={savingProfile}
            >
              Save account
            </Button>
          </form>
        </section>
      ) : null}

      {tab === 'security' ? (
        <section className="space-y-4">
          <p className="text-sm text-slate">
            Enter your current password to set a new one.
          </p>
          <form
            onSubmit={(e) => void handleChangePassword(e)}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                label="Current password"
                htmlFor="me-current-password"
                required
              >
                <Input
                  id="me-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={savingPassword}
                  autoComplete="current-password"
                />
              </FormField>
              <FormField label="New password" htmlFor="me-new-password" required>
                <Input
                  id="me-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={savingPassword}
                  autoComplete="new-password"
                />
              </FormField>
              <FormField
                label="Confirm new password"
                htmlFor="me-confirm-password"
                required
              >
                <Input
                  id="me-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={savingPassword}
                  autoComplete="new-password"
                />
              </FormField>
            </div>
            <Button
              type="submit"
              loading={savingPassword}
              disabled={savingPassword}
            >
              Update password
            </Button>
          </form>
        </section>
      ) : null}

      {tab === 'notifications' ? (
        <section className="space-y-3">
          <p className="text-sm text-slate">
            Saved on this device until email alerts are wired.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-navy">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border text-coral focus:ring-coral/40"
                checked={notifyPrefs.emailApprovals}
                onChange={(e) =>
                  handleNotifyChange({
                    ...notifyPrefs,
                    emailApprovals: e.target.checked,
                  })
                }
              />
              <span>
                <span className="font-medium">Approval updates</span>
                <span className="mt-0.5 block text-slate">
                  When your submitted time is approved or rejected.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-navy">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-border text-coral focus:ring-coral/40"
                checked={notifyPrefs.emailDigest}
                onChange={(e) =>
                  handleNotifyChange({
                    ...notifyPrefs,
                    emailDigest: e.target.checked,
                  })
                }
              />
              <span>
                <span className="font-medium">Weekly digest</span>
                <span className="mt-0.5 block text-slate">
                  A short summary of your hours for the week.
                </span>
              </span>
            </label>
          </div>
        </section>
      ) : null}

      {tab === 'organisation' && canEditOrg ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="text-sm text-slate">
              {orgName} defaults. Clients can override currency on their form.
            </p>
            <Button
              type="button"
              loading={savingOrg}
              disabled={savingOrg}
              onClick={() => void handleSaveOrg()}
            >
              Save organisation
            </Button>
          </div>

          <form
            onSubmit={(e) => void handleSaveOrg(e)}
            className="max-w-sm"
          >
            <FormField label="Default currency" htmlFor="org-currency">
              <CurrencySelect
                id="org-currency"
                value={currency}
                onChange={setCurrency}
                disabled={savingOrg}
              />
            </FormField>
          </form>
        </section>
      ) : null}
    </div>
  );
}
