'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/components/common/Toast';
import { LeavePeoplePanel } from '@/components/settings/LeavePeoplePanel';
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

type SettingsTab = 'account' | 'notifications' | 'organisation' | 'leave';

type OrganisationSettings = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  managersCanSeeMargin?: boolean;
  timersEnabled?: boolean;
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftCapacityYear(yearMonth: string, delta: number): string {
  const [y, m] = yearMonth.split('-');
  const year = Number(y) + delta;
  if (!Number.isFinite(year) || !m) return yearMonth;
  return `${year}-${m}`;
}

/** `YYYY-MM` → `September 2026`. */
function formatFullYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.slice(0, 7).split('-');
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1) {
    return yearMonth;
  }
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Personal Settings (everyone) + Organisation defaults (rate:edit) + Leave.
 * Tabs — Account & security / Notifications / Organisation / Leave.
 */
export default function SettingsPage() {
  const toast = useToast();
  const { me, refreshMe, changePassword } = useAuth();
  const { can, highestRole } = usePermissions();
  const canEditOrg = can('rate', 'edit');
  const showLeave =
    highestRole === 'owner' ||
    highestRole === 'admin' ||
    highestRole === 'team_manager';
  const showOrganisation = canEditOrg;

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
  const [confirmCapacityOpen, setConfirmCapacityOpen] = useState(false);
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
    if (!canEditOrg || tab !== 'leave') return;
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
    if (!canEditOrg || tab !== 'leave') return;
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

  function requestSaveCapacity(event?: FormEvent) {
    event?.preventDefault();
    if (!canEditOrg) return;
    const hours = Number(plannedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      toast.error('Enter planned hours as a number ≥ 0');
      return;
    }
    setConfirmCapacityOpen(true);
  }

  async function handleConfirmSaveCapacity() {
    if (!canEditOrg) return;
    const hours = Number(plannedHours);
    if (!Number.isFinite(hours) || hours < 0) {
      toast.error('Enter planned hours as a number ≥ 0');
      setConfirmCapacityOpen(false);
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
      setConfirmCapacityOpen(false);
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

  const capacityYear = Number(capacityMonth.slice(0, 4)) || new Date().getFullYear();
  const hoursByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of recentMonths) {
      map[row.yearMonth] = row.plannedHours;
    }
    return map;
  }, [recentMonths]);

  const tabs = useMemo(() => {
    const list: { id: SettingsTab; label: string }[] = [
      { id: 'account', label: 'Account & security' },
      { id: 'notifications', label: 'Notifications' },
    ];
    if (showOrganisation) {
      list.push({ id: 'organisation', label: 'Organisation' });
    }
    if (showLeave) {
      list.push({ id: 'leave', label: 'Leave' });
    }
    return list;
  }, [showOrganisation, showLeave]);

  useEffect(() => {
    if (tab === 'organisation' && !showOrganisation) {
      setTab('account');
    } else if (tab === 'leave' && !showLeave) {
      setTab('account');
    }
  }, [tab, showOrganisation, showLeave]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your account, organisation defaults, and leave when you manage them."
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
        <section className="max-w-2xl space-y-6">
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
              </FormField>
            </div>

            <div>
              <p className="text-sm font-medium text-navy">Email</p>
              <p className="mt-1 text-sm text-ink">{email}</p>
              <p className="mt-1 text-xs text-slate">
                From your sign-in account — not editable here.
              </p>
            </div>

            <Button
              type="submit"
              loading={savingProfile}
              disabled={savingProfile}
            >
              Save account
            </Button>
          </form>

          <div className="space-y-4 border-t border-border/60 pt-6">
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
                <FormField
                  label="New password"
                  htmlFor="me-new-password"
                  required
                >
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
          </div>
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
                  onChange={(e) => setManagersCanSeeMargin(e.target.checked)}
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
                    Show Start timer on the timesheet. Off by default — people
                    add time with start and end instead.
                  </span>
                </span>
              </label>
            </form>
          </div>
        </section>
      ) : null}

      {tab === 'leave' && showLeave ? (
        <section>
          <div className="rounded-xl border border-border/80 bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">Leave</h3>
                <p className="mt-0.5 text-sm text-slate">
                  Utilisation planning ·{' '}
                  <span className="font-medium text-ink">
                    {formatFullYearMonth(capacityMonth)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Previous year"
                  onClick={() =>
                    setCapacityMonth((ym) => shiftCapacityYear(ym, -1))
                  }
                >
                  ‹ Previous
                </Button>
                <span className="min-w-[3.25rem] px-1 text-center text-base font-semibold tabular-nums text-ink">
                  {capacityYear}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  aria-label="Next year"
                  onClick={() =>
                    setCapacityMonth((ym) => shiftCapacityYear(ym, 1))
                  }
                >
                  Next ›
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <ul className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-12">
                {MONTH_LABELS.map((label, index) => {
                  const monthKey = `${capacityYear}-${String(index + 1).padStart(2, '0')}`;
                  const selected = monthKey === capacityMonth;
                  const hours = hoursByMonth[monthKey];
                  return (
                    <li key={monthKey}>
                      <button
                        type="button"
                        className={cn(
                          'flex w-full flex-col items-center rounded-md px-1 py-2 text-center transition',
                          selected
                            ? 'bg-coral/15 font-semibold text-coral'
                            : 'text-slate hover:bg-paper hover:text-navy',
                        )}
                        onClick={() => setCapacityMonth(monthKey)}
                      >
                        <span className="text-sm">{label}</span>
                        <span className="mt-0.5 min-h-[1rem] text-xs tabular-nums text-inherit opacity-90">
                          {hours != null ? `${hours}h` : '\u00a0'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {canEditOrg ? (
                <form
                  onSubmit={(e) => void requestSaveCapacity(e)}
                  className="flex flex-wrap items-end gap-3"
                >
                  <FormField
                    label="Planned hours"
                    htmlFor="planned-hours"
                    className="w-28"
                  >
                    <Input
                      id="planned-hours"
                      type="text"
                      inputMode="decimal"
                      value={plannedHours}
                      disabled={savingCapacity || loadingCapacity}
                      placeholder="e.g. 160"
                      onChange={(e) => setPlannedHours(e.target.value)}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    size="sm"
                    className="mb-px"
                    disabled={savingCapacity || loadingCapacity}
                  >
                    Save capacity
                  </Button>
                </form>
              ) : null}
            </div>

            <div className="mt-5 border-t border-border/60 pt-4">
              <LeavePeoplePanel
                yearMonth={capacityMonth}
                hideMonthControl
              />
            </div>
          </div>
        </section>
      ) : null}

      <ConfirmDialog
        open={confirmCapacityOpen}
        title="Save planned hours?"
        description={`Set planned hours for ${formatDisplayYearMonth(capacityMonth)} to ${plannedHours}. This affects utilisation reports.`}
        confirmLabel="Save capacity"
        loading={savingCapacity}
        onConfirm={() => void handleConfirmSaveCapacity()}
        onCancel={() => {
          if (!savingCapacity) setConfirmCapacityOpen(false);
        }}
      />
    </div>
  );
}
