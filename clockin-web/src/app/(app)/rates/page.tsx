'use client';

import { useEffect, useMemo, useState } from 'react';
import { MonthCalendarField } from '@/components/rates/MonthCalendarField';
import { RateForm } from '@/components/rates/RateForm';
import { RatePairForm } from '@/components/rates/RatePairForm';
import { ProjectPersonRatesTable } from '@/components/rates/ProjectPersonRatesTable';
import { RatesTable } from '@/components/rates/RatesTable';
import { EmptyState } from '@/components/common/EmptyState';
import { Modal } from '@/components/common/Modal';
import { PageHeader } from '@/components/common/PageHeader';
import { Pagination } from '@/components/common/Pagination';
import { ListSkeleton } from '@/components/common/Skeleton';
import { useToast } from '@/components/common/Toast';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { SearchField } from '@/components/common/SearchField';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api-client';
import { clientLabel } from '@/lib/client-label';
import { getErrorMessage } from '@/lib/get-error-message';
import {
  fallbackScopeRates,
  pairProjectUserRates,
} from '@/lib/rate-pairs';
import { useRates } from '@/lib/use-rates';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  CreateRateInput,
  CreateRatePairInput,
  CreateRatePairResult,
  Member,
  Paginated,
  Project,
  Rate,
  RateScope,
  RateType,
  Task,
} from '@/types/api';

type RatesTab = 'current' | 'track';
type AddModalMode = 'pair' | 'advanced' | null;

function currentMonthValue(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/**
 * Rates — project-person pairs first; fallback scopes secondary (FIX 1).
 */
export default function RatesPage() {
  const toast = useToast();
  const { me } = useAuth();
  const { can } = usePermissions();
  const canView = can('rate', 'view');
  const canEdit = can('rate', 'edit');
  const canViewMembers = can('member', 'view');

  const orgName = me?.organisation?.name ?? 'Organisation';
  const orgCurrency = me?.organisation?.currency ?? 'GBP';

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<RatesTab>('current');
  const [rateType, setRateType] = useState<RateType | 'all'>('all');
  const [scope, setScope] = useState<RateScope | 'all'>('all');
  const [clientId, setClientId] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('all');
  const [userId, setUserId] = useState<string>('all');
  const [month, setMonth] = useState(currentMonthValue);
  const [nameQuery, setNameQuery] = useState('');
  const [modalMode, setModalMode] = useState<AddModalMode>(null);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const { data, pageSize, loading, error, reload } = useRates({
    page,
    pageSize: 100,
    rateType,
    scope,
    clientId,
    projectId,
    userId,
    current: tab === 'current' ? true : undefined,
    month: tab === 'track' ? month : undefined,
    q: nameQuery,
  });

  const pairRows = useMemo(
    () =>
      pairProjectUserRates(data, tab === 'track' ? 'history' : 'current'),
    [data, tab],
  );
  const fallbackRows = useMemo(() => fallbackScopeRates(data), [data]);

  const showPairSection = scope === 'all' || scope === 'project_user';
  const showFallbacks =
    scope === 'all' ||
    scope === 'organisation' ||
    scope === 'client' ||
    scope === 'project' ||
    scope === 'user' ||
    scope === 'task';

  const visiblePairCount = showPairSection ? pairRows.length : 0;
  const visibleFallbackCount =
    showFallbacks && fallbackRows.length > 0 ? fallbackRows.length : 0;
  const visibleTotal = visiblePairCount + visibleFallbackCount;

  const isEmpty =
    (showPairSection ? pairRows.length === 0 : true) &&
    (showFallbacks ? fallbackRows.length === 0 : true);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;

    async function loadLookups() {
      try {
        const [clientsRes, projectsRes, tasksRes] = await Promise.all([
          api<Paginated<Client>>('/clients?pageSize=100&status=active'),
          api<Paginated<Project>>('/projects?pageSize=100&status=active'),
          api<Paginated<Task>>('/tasks?pageSize=100&status=open'),
        ]);
        let membersData: Member[] = [];
        if (canViewMembers) {
          const membersRes = await api<Paginated<Member>>(
            '/members?pageSize=100&status=active',
          );
          membersData = membersRes.data ?? [];
        }
        if (!cancelled) {
          setClients(clientsRes.data ?? []);
          setProjects(projectsRes.data ?? []);
          setTasks(tasksRes.data ?? []);
          setMembers(membersData);
        }
      } catch {
        if (!cancelled) {
          setClients([]);
          setProjects([]);
          setTasks([]);
          setMembers([]);
        }
      }
    }

    void loadLookups();
    return () => {
      cancelled = true;
    };
  }, [canView, canViewMembers]);

  const filteredProjects = useMemo(() => {
    if (clientId === 'all') return projects;
    return projects.filter((p) => p.clientId === clientId);
  }, [projects, clientId]);

  async function handleCreatePair(values: CreateRatePairInput) {
    setSubmitting(true);
    try {
      const res = await api<CreateRatePairResult>('/rates/pair', {
        method: 'POST',
        body: values,
      });
      const marginLabel =
        res.marginPercent != null
          ? `${res.marginAmount} ${res.currency}/h (${Number(res.marginPercent).toFixed(0)}%)`
          : `${res.marginAmount} ${res.currency}/h`;
      toast.success(`Rates saved · margin ${marginLabel}`);
      setModalMode(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not save rate pair'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreate(values: CreateRateInput) {
    setSubmitting(true);
    try {
      await api<Rate>('/rates', { method: 'POST', body: values });
      toast.success('Rate added (previous open rate closed if same identity)');
      setModalMode(null);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not add rate'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader
          title="Rates"
          description="Cost and billable rates for your organisation."
          helpKey="rates"
        />
        <EmptyState
          title="No access"
          description="You need the rate:view permission to see rates. Ask an owner or admin."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Rates"
        description={`${orgName} · ${orgCurrency}`}
        helpKey="rates"
        actions={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setModalMode('advanced')}
              >
                Advanced
              </Button>
              <Button type="button" onClick={() => setModalMode('pair')}>
                Set project rates
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-1 border-b border-navy/10">
        {(
          [
            ['current', 'Current'],
            ['track', 'Track'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setPage(1);
            }}
            className={
              tab === key
                ? 'border-b-2 border-coral px-4 py-2 text-sm font-medium text-coral'
                : 'px-4 py-2 text-sm text-slate hover:text-navy'
            }
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex items-center gap-2 text-sm text-slate">
          Type
          <Select
            className="w-36"
            value={rateType}
            onChange={(e) => {
              setPage(1);
              setRateType(e.target.value as RateType | 'all');
            }}
          >
            <option value="all">All</option>
            <option value="billable">Billable</option>
            <option value="cost">Cost</option>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate">
          Scope
          <Select
            className="min-w-[160px]"
            value={scope}
            onChange={(e) => {
              setPage(1);
              setScope(e.target.value as RateScope | 'all');
            }}
          >
            <option value="all">All scopes</option>
            <option value="project_user">Project + person</option>
            <optgroup label="Other rates">
              <option value="organisation">Organisation</option>
              <option value="client">Client</option>
              <option value="project">Project</option>
              <option value="user">Person</option>
              <option value="task">Task</option>
            </optgroup>
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate">
          Client
          <Select
            className="min-w-[140px]"
            value={clientId}
            onChange={(e) => {
              setPage(1);
              setClientId(e.target.value);
              setProjectId('all');
            }}
          >
            <option value="all">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientLabel(c)}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex items-center gap-2 text-sm text-slate">
          Project
          <Select
            className="min-w-[140px]"
            value={projectId}
            onChange={(e) => {
              setPage(1);
              setProjectId(e.target.value);
            }}
          >
            <option value="all">All projects</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>

        {canViewMembers ? (
          <label className="flex items-center gap-2 text-sm text-slate">
            Person
            <Select
              className="min-w-[140px]"
              value={userId}
              onChange={(e) => {
                setPage(1);
                setUserId(e.target.value);
              }}
            >
              <option value="all">Anyone</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name || m.user.email}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <div className="w-64 shrink-0">
          <SearchField
            value={nameQuery}
            onChange={(value) => {
              setPage(1);
              setNameQuery(value);
            }}
            placeholder="Project or person"
          />
        </div>

        {tab === 'track' ? (
          <MonthCalendarField
            value={month}
            onChange={(value) => {
              setPage(1);
              setMonth(value);
            }}
          />
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
      ) : isEmpty ? (
        <EmptyState
          title={
            tab === 'current' ? 'No current rates' : 'Nothing in this month'
          }
          description={
            canEdit && tab === 'current'
              ? 'Set cost and bill for a person on a project to get started.'
              : 'Nothing matches these filters.'
          }
          actionLabel={
            canEdit && tab === 'current' ? 'Set project rates' : undefined
          }
          onAction={
            canEdit && tab === 'current'
              ? () => setModalMode('pair')
              : undefined
          }
        />
      ) : (
        <div className="space-y-8">
          {showPairSection ? (
            <section className="space-y-3">
              <h2 className="text-base font-semibold tracking-tight text-navy">
                Project + person
              </h2>
              {pairRows.length === 0 ? (
                <p className="text-sm text-slate">
                  No pairs yet.
                  {canEdit && tab === 'current'
                    ? ' Use Set project rates.'
                    : ''}
                </p>
              ) : (
                <ProjectPersonRatesTable rows={pairRows} />
              )}
            </section>
          ) : null}

          {showFallbacks && fallbackRows.length > 0 ? (
            <section className="space-y-3 border-t border-navy/10 pt-6">
              <h2 className="text-base font-semibold tracking-tight text-navy">
                Other rates
              </h2>
              <RatesTable rates={fallbackRows} />
            </section>
          ) : null}

          <Pagination
            page={page}
            totalPages={Math.max(1, Math.ceil(visibleTotal / pageSize))}
            total={visibleTotal}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      <Modal
        open={modalMode === 'pair'}
        title="Set project rates"
        description="Pick client, then project, then person — cost and bill per hour."
        onClose={() => !submitting && setModalMode(null)}
        size="xl"
      >
        <RatePairForm
          projects={projects}
          clients={clients}
          members={members}
          orgCurrency={orgCurrency}
          submitting={submitting}
          onSubmit={handleCreatePair}
          onCancel={() => setModalMode(null)}
        />
      </Modal>

      <Modal
        open={modalMode === 'advanced'}
        title="Advanced rate"
        description="Single cost or billable row for org, client, project, person, or task."
        onClose={() => !submitting && setModalMode(null)}
        size="xl"
      >
        <RateForm
          clients={clients}
          projects={projects}
          tasks={tasks}
          members={members}
          orgCurrency={orgCurrency}
          submitting={submitting}
          onSubmit={handleCreate}
          onCancel={() => setModalMode(null)}
        />
      </Modal>
    </div>
  );
}
