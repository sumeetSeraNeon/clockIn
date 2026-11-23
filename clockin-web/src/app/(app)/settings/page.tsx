'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/components/common/Toast';
import { OrganisationLeavePanel } from '@/components/settings/OrganisationLeavePanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { ensureCurrencyOption } from '@/lib/currencies';
import { formatDisplayYearMonth } from '@/lib/date-range';
import { getFirebaseAuth } from '@/lib/firebase';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  loadNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '@/lib/notification-prefs';
import { COMMON_TIMEZONES, ensureTimezoneOption } from '@/lib/timezones';
import { usePermissions } from '@/lib/use-permissions';
import type {
  MeResponse,
  UpdateMeInput,
  UtilisationMonthListItem,
  UtilisationMonthResponse,
} from '@/types/api';

type SettingsTab = 'account' | 'security' | 'notifications' | 'organisation';

type OrganisationSettings = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  managersCanSeeMargin?: boolean;
  timersEnabled?: boolean;
};

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Personal Settings (everyone) + Organisation currency (rate:edit).
 * Tabbed panels — Account / Security / Notifications / Organisation.
 */
export default function SettingsPage() {
  const toast = useToast();
  const { me, refreshMe, changePassword } = useAuth();
  const { can, highestRole } = usePermissions();
  const canEditOrg = can('rate', 'edit');
  const canEditLeave =
    highestRole === 'owner' ||
    highestRole === 'admin' ||
    highestRole === 'team_manager';
  const showOrganisation = canEditOrg || canEditLeave;

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
  const [managersCanSeeMargin, setManagersCanSeeMargin] = useState(
    me?.organisation?.managersCanSeeMargin === true,
  );
  const [timersEnabled, setTimersEnabled] = useState(
    me?.organisation?.timersEnabled === true,
  );
  const [savingOrg, setSavingOrg] = useState(false);

  const [capacityMonth, setCapacityMonth] = useState(currentYearMonth);
  const [plannedHours, setPlannedHours] = useState('');
  const [loadingCapacity, setLoadingCapacity] = useState(false);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [recentMonths, setRecentMonths] = useState<UtilisationMonthListItem[]>(
    [],
  );
  const [recentReloadKey, setRecentReloadKey] = useState(0);

  useEffect(() => {
    setName(me?.user.name ?? '');
    setTimezone(ensureTimezoneOption(me?.user.timezone));
    setCurrency(ensureCurrencyOption(me?.organisation?.currency));
    setManagersCanSeeMargin(me?.organisation?.managersCanSeeMargin === true);
    setTimersEnabled(me?.organisation?.timersEnabled === true);
    if (me?.user.id) {
      setNotifyPrefs(loadNotificationPrefs(me.user.id));
    }
  }, [
    me?.user.id,
    me?.user.name,
    me?.user.timezone,
    me?.organisation?.currency,
    me?.organisation?.managersCanSeeMargin,
    me?.organisation?.timersEnabled,
  ]);

  useEffect(() => {
    if (!canEditOrg || tab !== 'organisation') return;
    let cancelled = false;
    async function loadCapacity() {
      setLoadingCapacity(true);
      try {
        const res = await api<UtilisationMonthResponse>(
          `/utilisation/months/${capacityMonth}`,
        );
        if (!cancelled) {
          setPlannedHours(
            res.plannedHours != null ? String(res.plannedHours) : '',
          );
        }
      } catch {
        if (!cancelled) setPlannedHours('');
      } finally {
        if (!cancelled) setLoadingCapacity(false);
      }
    }
    void loadCapacity();
    return () => {
      cancelled = true;
    };
  }, [canEditOrg, tab, capacityMonth]);

  useEffect(() => {
    if (!canEditOrg || tab !== 'organisation') return;
    let cancelled = false;
    async function loadRecent() {
      try {
        const rows = await api<UtilisationMonthListItem[]>(
          '/utilisation/months',
        );
        if (!cancelled) setRecentMonths(rows ?? []);
      } catch {
        if (!cancelled) setRecentMonths([]);
      }
    }
    void loadRecent();
    return () => {
      cancelled = true;
    };
  }, [canEditOrg, tab, recentReloadKey]);

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
        body: {
          currency: currency.toUpperCase(),
          managersCanSeeMargin,
          timersEnabled,
        },
      });
      await refreshMe();
      toast.success(
        `Organisation saved · currency ${res.currency}${
          res.managersCanSeeMargin ? ' · managers can see margin' : ''
        }${res.timersEnabled ? ' · timers on' : ''}`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save organisation settings'));
    } finally {
      setSavingOrg(false);
    }
  }

  async function handleSaveCapacity(event?: FormEvent) {
    event?.preventDefault();
    if (!canEditOrg) return;
    const hours = Number(plannedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      toast.error('Enter planned hours as a number ≥ 0');
      return;
    }
    setSavingCapacity(true);
    try {
      const res = await api<UtilisationMonthResponse>(
        `/utilisation/months/${capacityMonth}`,
        {
          method: 'PUT',
          body: { plannedHours: hours },
        },
      );
      setPlannedHours(
        res.plannedHours != null ? String(res.plannedHours) : String(hours),
      );
      setRecentReloadKey((k) => k + 1);
      toast.success(
        `Capacity saved for ${formatDisplayYearMonth(capacityMonth)}`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save monthly capacity'));
    } finally {
      setSavingCapacity(false);
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
    if (showOrganisation) {
      list.push({ id: 'organisation', label: 'Organisation' });
    }
    return list;
  }, [showOrganisation]);

  useEffect(() => {
    if (tab === 'organisation' && !showOrganisation) {
      setTab('account');
    }
  }, [tab, showOrganisation]);

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

      {tab === 'organisation' && showOrganisation ? (
        <section className="max-w-3xl space-y-5">
          {canEditOrg ? (
            <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">Defaults</h3>
                  <p className="mt-0.5 text-sm text-slate">
                    {orgName} · clients can override currency
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  loading={savingOrg}
                  disabled={savingOrg}
                  onClick={() => void handleSaveOrg()}
                >
                  Save organisation
                </Button>
              </div>
              <form
                onSubmit={(e) => void handleSaveOrg(e)}
                className="mt-4 grid gap-4 sm:grid-cols-2"
              >
                <FormField label="Default currency" htmlFor="org-currency">
                  <CurrencySelect
                    id="org-currency"
                    value={currency}
                    onChange={setCurrency}
                    disabled={savingOrg}
                  />
                </FormField>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-ink sm:pt-6">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-coral"
                    checked={managersCanSeeMargin}
                    disabled={savingOrg}
                    onChange={(e) =>
                      setManagersCanSeeMargin(e.target.checked)
                    }
                  />
                  <span>
                    <span className="font-medium">
                      Allow managers to see margin
                    </span>
                    <span className="mt-0.5 block text-xs text-slate">
                      Admins/owners always see money; members never do.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3 text-sm text-ink sm:col-span-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-coral"
                    checked={timersEnabled}
                    disabled={savingOrg}
                    onChange={(e) => setTimersEnabled(e.target.checked)}
                  />
                  <span>
                    <span className="font-medium">Allow timers</span>
                    <span className="mt-0.5 block text-xs text-slate">
                      Show Start timer on the timesheet. Off by default —
                      people add time with start and end instead.
                    </span>
                  </span>
                </label>
              </form>
            </div>
          ) : (
            <p className="text-sm text-slate">
              Manage leave for people you manage. Capacity and org defaults stay
              with admins.
            </p>
          )}

          {(canEditOrg || canEditLeave) && (
            <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    Capacity & leave
                  </h3>
                  <p className="mt-0.5 text-sm text-slate">
                    Shared month for utilisation planning
                  </p>
                </div>
                <label className="flex w-40 flex-col gap-1 text-xs text-slate">
                  Month
                  <Input
                    id="capacity-month"
                    type="month"
                    value={capacityMonth}
                    disabled={canEditOrg && (savingCapacity || loadingCapacity)}
                    onChange={(e) => setCapacityMonth(e.target.value)}
                  />
                </label>
              </div>

              <div
                className={cn(
                  'mt-4 grid gap-5',
                  canEditOrg && canEditLeave
                    ? 'sm:grid-cols-2 sm:gap-6'
                    : 'grid-cols-1',
                )}
              >
                {canEditOrg ? (
                  <form
                    onSubmit={(e) => void handleSaveCapacity(e)}
                    className="space-y-3"
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-slate">
                      Planned hours
                    </p>
                    <FormField label="Hours" htmlFor="planned-hours">
                      <Input
                        id="planned-hours"
                        type="number"
                        min={0}
                        step={0.5}
                        value={plannedHours}
                        disabled={savingCapacity || loadingCapacity}
                        placeholder="e.g. 160"
                        onChange={(e) => setPlannedHours(e.target.value)}
                      />
                    </FormField>
                    <Button
                      type="submit"
                      size="sm"
                      loading={savingCapacity}
                      disabled={savingCapacity || loadingCapacity}
                    >
                      Save capacity
                    </Button>
                    {recentMonths.length > 0 ? (
                      <ul className="max-h-36 overflow-y-auto divide-y divide-border/80 rounded-lg border border-border/80">
                        {recentMonths.slice(0, 6).map((row) => (
                          <li key={row.yearMonth}>
                            <button
                              type="button"
                              className={cn(
                                'flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition hover:bg-paper',
                                row.yearMonth === capacityMonth
                                  ? 'bg-paper font-medium text-ink'
                                  : 'text-navy',
                              )}
                              onClick={() => setCapacityMonth(row.yearMonth)}
                            >
                              <span>
                                {formatDisplayYearMonth(row.yearMonth)}
                              </span>
                              <span className="tabular-nums text-slate">
                                {row.plannedHours}h
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </form>
                ) : null}

                {canEditLeave ? (
                  <div
                    className={cn(
                      canEditOrg && 'border-t border-border/60 pt-4 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0',
                    )}
                  >
                    <OrganisationLeavePanel
                      yearMonth={capacityMonth}
                      hideMonthControl
                    />
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
