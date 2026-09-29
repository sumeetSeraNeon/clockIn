'use client';

import { useEffect, useMemo, useState } from 'react';
import { RateForm } from '@/components/rates/RateForm';
import { RatesTable } from '@/components/rates/RatesTable';
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
import { useRates } from '@/lib/use-rates';
import { usePermissions } from '@/lib/use-permissions';
import type {
  Client,
  CreateRateInput,
  Member,
  Paginated,
  Project,
  Rate,
  RateScope,
  RateType,
  Task,
} from '@/types/api';

type RatesTab = 'current' | 'history';

/**
 * Rates — Current vs History tabs, entity filters, enriched applies-to.
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
  const [modalOpen, setModalOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);

  const { data, total, totalPages, pageSize, loading, error, reload } =
    useRates({
      page,
      pageSize: 50,
      rateType,
      scope,
      clientId,
      projectId,
      userId,
      current: tab === 'current',
    });

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

  async function handleCreate(values: CreateRateInput) {
    setSubmitting(true);
    try {
      await api<Rate>('/rates', { method: 'POST', body: values });
      toast.success('Rate added (previous open rate closed if same identity)');
      setModalOpen(false);
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
        description={`${orgName} · ${orgCurrency}. Billable = what you charge; cost = what it costs you. New rows never overwrite history.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setLookupOpen(true)}
            >
              Check effective rate
            </Button>
            {canEdit ? (
              <Button type="button" onClick={() => setModalOpen(true)}>
                Add rate
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-navy/10">
        {(
          [
            ['current', 'Current'],
            ['history', 'History'],
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

      <div className="mb-4 flex flex-wrap items-center gap-3">
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
            <option value="organisation">Organisation</option>
            <option value="client">Client</option>
            <option value="project">Project</option>
            <option value="user">Person</option>
            <option value="task">Task</option>
            <option value="project_user">Project + person</option>
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
                {c.name}
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
      ) : data.length === 0 ? (
        <EmptyState
          title={
            tab === 'current' ? 'No current rates' : 'No historical rates'
          }
          description={
            canEdit && tab === 'current'
              ? 'Add an organisation billable or cost rate to get started. History is kept when you add a new effective date.'
              : 'Nothing matches these filters.'
          }
          actionLabel={canEdit && tab === 'current' ? 'Add rate' : undefined}
          onAction={
            canEdit && tab === 'current'
              ? () => setModalOpen(true)
              : undefined
          }
        />
      ) : (
        <>
          <RatesTable rates={data} />
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
        open={modalOpen}
        title="Add rate"
        description="Creates a new effective-dated row. Matching open rates are closed automatically."
        onClose={() => !submitting && setModalOpen(false)}
      >
        <RateForm
          clients={clients}
          projects={projects}
          tasks={tasks}
          members={members}
          submitting={submitting}
          onSubmit={handleCreate}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      <Modal
        open={lookupOpen}
        title="Check effective rate"
        description="Uses the same lookup as reports: most-specific matching rate on a date."
        onClose={() => setLookupOpen(false)}
        className="max-w-lg"
      >
        <RateLookupPanel
          clients={clients}
          projects={projects}
          tasks={tasks}
          members={members}
          onClose={() => setLookupOpen(false)}
        />
      </Modal>
    </div>
  );
}

function RateLookupPanel({
  clients,
  projects,
  tasks,
  members,
  onClose,
}: {
  clients: Client[];
  projects: Project[];
  tasks: Task[];
  members: Member[];
  onClose: () => void;
}) {
  const [rateType, setRateType] = useState<RateType>('billable');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [userId, setUserId] = useState('');
  const [taskId, setTaskId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    amount: string | null;
    currency: string | null;
    matchedScope: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const projectTasks = useMemo(
    () =>
      projectId ? tasks.filter((t) => t.projectId === projectId) : tasks,
    [tasks, projectId],
  );

  async function runLookup() {
    setLoading(true);
    setError(null);
    try {
      const res = await api<{
        amount: string | null;
        currency: string | null;
        matchedScope: string | null;
      }>('/rates/lookup', {
        method: 'POST',
        body: {
          rateType,
          date,
          ...(clientId ? { clientId } : {}),
          ...(projectId ? { projectId } : {}),
          ...(userId ? { userId } : {}),
          ...(taskId ? { taskId } : {}),
        },
      });
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(getErrorMessage(err, 'Lookup failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate">
          Type
          <Select
            value={rateType}
            onChange={(e) => setRateType(e.target.value as RateType)}
          >
            <option value="billable">Billable (charge)</option>
            <option value="cost">Cost</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-navy/15 bg-white px-3 py-2 text-sm text-navy"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          Client
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          >
            <option value="">Any</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          Project
          <Select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setTaskId('');
            }}
          >
            <option value="">Any</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          Person
          <Select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Any</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name || m.user.email}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate">
          Task
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Any</option>
            {projectTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {result ? (
        <div className="rounded-lg bg-paper px-4 py-3 text-sm">
          {result.amount != null ? (
            <p className="font-medium text-navy">
              {Number(result.amount).toFixed(2)}{' '}
              {result.currency ?? 'GBP'}
              <span className="ml-2 font-normal text-slate">
                via {result.matchedScope?.replace(/_/g, ' ') ?? 'unknown'} scope
              </span>
            </p>
          ) : (
            <p className="text-slate">No matching rate for this context.</p>
          )}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" loading={loading} onClick={() => void runLookup()}>
          Look up
        </Button>
      </div>
    </div>
  );
}
