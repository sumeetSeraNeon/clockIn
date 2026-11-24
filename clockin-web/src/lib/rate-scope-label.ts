/** Human labels for rate scope enums (matches Rates UI language). */
const RATE_SCOPE_LABELS: Record<string, string> = {
  organisation: 'Organisation',
  client: 'Client',
  project: 'Project',
  user: 'Person',
  task: 'Task',
  project_user: 'Project + person',
};

export function rateScopeLabel(scope: string | null | undefined): string | null {
  if (!scope) return null;
  return RATE_SCOPE_LABELS[scope] ?? scope.replace(/_/g, ' ');
}
