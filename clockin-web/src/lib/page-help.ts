/**
 * Plain-language help for main nav screens (Phase 3).
 * Shown via PageHeader → InfoTip — short, not walls of text.
 */

export type PageHelpKey =
  | 'dashboard'
  | 'timesheet'
  | 'calendar'
  | 'approvals'
  | 'clients'
  | 'projects'
  | 'tasks'
  | 'tickets'
  | 'team'
  | 'rates'
  | 'reports'
  | 'settings';

export type PageHelp = {
  /** Panel heading (can match the screen name). */
  title: string;
  /** 2–4 short sentences / bullets as separate paragraphs. */
  paragraphs: string[];
};

export const PAGE_HELP: Record<PageHelpKey, PageHelp> = {
  dashboard: {
    title: 'Dashboard',
    paragraphs: [
      'Your landing view for the period you pick (week, month, or custom).',
      'Managers and admins see team and commercial highlights when they have report access. Members see their own hours and tasks only.',
      'Change the dates at the top — the panels below update to match.',
    ],
  },
  timesheet: {
    title: 'Timesheet',
    paragraphs: [
      'Log time on tasks you can access, then submit a day or week for approval.',
      'Use Client → Project → Task to find work. The timer sits in this flow; submitted or approved periods lock for edit.',
      'Submit from here — Calendar is for overview, not the main submit path.',
    ],
  },
  calendar: {
    title: 'Calendar',
    paragraphs: [
      'See logged and locked time on a calendar. Drag a range to add an entry (past or today only — not future dates).',
      'Submit days or weeks from Timesheet. Locked periods stay visible but are not editable here.',
    ],
  },
  approvals: {
    title: 'Approvals',
    paragraphs: [
      'Review time waiting for a decision. Expand a row for the project and task breakdown, then approve or reject.',
      'Line managers and project managers see their team or projects. Admins and owners can also open the org-wide log.',
      'Rejecting needs a short reason so the person can fix and resubmit.',
    ],
  },
  clients: {
    title: 'Clients',
    paragraphs: [
      'Clients are the organisations you deliver work for. Projects sit under a client.',
      'Filter by status and search by name or code. Archive keeps history without deleting.',
      'What you see depends on your role — members only see clients tied to their work.',
    ],
  },
  projects: {
    title: 'Projects',
    paragraphs: [
      'Projects are delivery work under a client. Open a project for tasks, team, and tickets.',
      'Filter by status or client, and search by name or code. Members see projects they are assigned to (read-only).',
    ],
  },
  tasks: {
    title: 'Tasks',
    paragraphs: [
      'Tasks are the work items you track time against. They belong to a project.',
      'Filter by status, project, or assignee, and search by name. Use Track to open activity and timing for that task.',
      'Mark done or archive when work is finished — archived tasks stay findable with the Archived filter.',
    ],
  },
  tickets: {
    title: 'Tickets',
    paragraphs: [
      'Tickets are incidents and service requests linked to a client (and optionally a project).',
      'Status only moves forward: open → in progress → resolved → closed. Search by reference or title.',
      'Members can view tickets on their projects; creating and advancing needs ticket edit access.',
    ],
  },
  team: {
    title: 'Team',
    paragraphs: [
      'People in the organisation: invites, roles, line manager, and status.',
      'Search by name or email. Admins can filter by manager. Pending people need approval before they can sign in.',
      'You cannot deactivate yourself. Removing someone lets you invite that email again.',
    ],
  },
  rates: {
    title: 'Rates',
    paragraphs: [
      'Cost and billable rates used for reporting and pricing. Pair rates attach people to projects with cost and sell amounts.',
      'Currency follows the client when set, otherwise the organisation default.',
      'Only people with rate access see this screen — members do not.',
    ],
  },
  reports: {
    title: 'Reports',
    paragraphs: [
      'Hours, billable mix, budget burn, utilisation, and (when you have rate access) money views.',
      'Revenue and profitability use approved time. Export CSV for the current filters.',
      'Pick a date range and use the tabs to switch report types.',
    ],
  },
  settings: {
    title: 'Settings',
    paragraphs: [
      'Your account: profile, password, and notification preferences.',
      'Organisation defaults (currency and similar) appear only if you manage the org.',
      'Personal settings are available to everyone; org sections stay permission-gated.',
    ],
  },
};
