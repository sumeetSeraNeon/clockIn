'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CurrencySelect } from '@/components/common/CurrencySelect';
import { FormField } from '@/components/common/FormField';
import { PageHeader } from '@/components/common/PageHeader';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { ensureCurrencyOption } from '@/lib/currencies';
import { getErrorMessage } from '@/lib/get-error-message';
import { usePermissions } from '@/lib/use-permissions';

type OrganisationSettings = {
  id: string;
  name: string;
  code: string | null;
  currency: string;
};

/**
 * FIX 3 — organisation default currency (only place org currency is chosen).
 * Flat layout — no nested card (matches Timesheet strip style).
 */
export default function SettingsPage() {
  const toast = useToast();
  const { me, refreshMe } = useAuth();
  const { can } = usePermissions();
  const canEdit = can('rate', 'edit');

  const [currency, setCurrency] = useState(
    ensureCurrencyOption(me?.organisation?.currency),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCurrency(ensureCurrencyOption(me?.organisation?.currency));
  }, [me?.organisation?.currency]);

  async function handleSave(event?: FormEvent) {
    event?.preventDefault();
    setSaving(true);
    try {
      const res = await api<OrganisationSettings>('/organisation', {
        method: 'PATCH',
        body: { currency: currency.toUpperCase() },
      });
      await refreshMe();
      toast.success(`Default currency set to ${res.currency}`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save settings'));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <PageHeader
          title="Settings"
          description="Organisation settings are limited to owners and admins."
        />
        <p className="text-sm text-slate">
          You do not have permission to change organisation settings.
        </p>
      </div>
    );
  }

  const orgName = me?.organisation?.name ?? 'Organisation';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Settings"
        description={`${orgName} defaults. A client can still override currency on its own form.`}
        actions={
          <Button
            type="button"
            loading={saving}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            Save
          </Button>
        }
      />

      <form
        onSubmit={(e) => void handleSave(e)}
        className="space-y-5"
      >
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate">
              Currency
            </h2>
            <p className="mt-1 text-sm text-slate">
              Default for rates and money when a client has no override. Shown
              as a static label on rate forms — not a dropdown each time.
            </p>
          </div>

          <FormField label="Default currency" htmlFor="org-currency">
            <CurrencySelect
              id="org-currency"
              value={currency}
              onChange={setCurrency}
              disabled={saving}
              className="max-w-sm"
            />
          </FormField>
        </section>
      </form>
    </div>
  );
}
