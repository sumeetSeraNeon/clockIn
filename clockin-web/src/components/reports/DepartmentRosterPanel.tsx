'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { getErrorMessage } from '@/lib/get-error-message';
import type { DepartmentRoster } from '@/types/api';

type DepartmentRosterPanelProps = {
  departmentId: string;
  dateFrom: string;
  dateTo: string;
};

function hoursLabel(hours: number) {
  return `${hours.toFixed(1)}h`;
}

export function DepartmentRosterPanel({
  departmentId,
  dateFrom,
  dateTo,
}: DepartmentRosterPanelProps) {
  const [roster, setRoster] = useState<DepartmentRoster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ dateFrom, dateTo });
    api<DepartmentRoster>(`/departments/${departmentId}/roster?${params}`)
      .then((res) => {
        if (!cancelled) setRoster(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setRoster(null);
          setError(getErrorMessage(err, 'Could not load department roster'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentId, dateFrom, dateTo]);

  if (loading) {
    return <p className="text-sm text-slate">Loading department…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
  }
  if (!roster) return null;

  return (
    <section className="mb-4 rounded-lg border border-border bg-card px-4 py-4">
      <h2 className="text-base font-semibold text-navy">
        {roster.department.name}
      </h2>
      <p className="mt-1 text-sm text-slate">
        Projects these people are on, then each person&apos;s own projects.
        Hours are approved time in the selected dates.
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-medium text-navy">All projects</h3>
        {roster.projects.length === 0 ? (
          <p className="mt-1 text-sm text-slate">No projects yet.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {roster.projects.map((project) => (
              <li
                key={project.id}
                className="rounded-full border border-navy/10 px-3 py-1 text-sm text-navy"
              >
                {project.name}
                {project.clientName ? ` · ${project.clientName}` : ''} ·{' '}
                {hoursLabel(project.hours)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <h3 className="text-sm font-medium text-navy">People</h3>
        {roster.people.length === 0 ? (
          <p className="text-sm text-slate">No people in this department.</p>
        ) : (
          roster.people.map((person) => (
            <div key={person.membershipId}>
              <p className="text-sm font-medium text-navy">
                {person.name || person.email}
              </p>
              {person.projects.length === 0 ? (
                <p className="text-sm text-slate">No projects</p>
              ) : (
                <ul className="mt-1 text-sm text-slate">
                  {person.projects.map((project) => (
                    <li key={project.id}>
                      {project.name}
                      {project.clientName ? ` · ${project.clientName}` : ''} ·{' '}
                      {hoursLabel(project.hours)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
