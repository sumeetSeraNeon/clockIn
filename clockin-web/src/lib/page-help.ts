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
  | 'departments'
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
      'Log time on tasks you can access, then submit a day, week, or custom period for approval.',
      'The day slots bar shows 24 hours as twelve 2-hour blocks in one row. In Week or Period, pick a day chip to switch which day the bar shows. Click a free segment to add time (start and end only).',
      'Approved periods stay open for new drafts — submit again for another approval round. Already approved entries stay read-only. Calendar is for overview.',
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
      'Project managers see submissions on projects they own. Admins and owners see everything and can open the org-wide log.',
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
    title: 'Tickets and CRs',
    paragraphs: [
      'Tickets and change requests are work items linked to a client (and optionally a project and department).',
      'Import an Excel export to create or update by Ticket ID. Include Project (required). Group must match an existing Department. Change Request rows can set CR Approval, Value, and Currency.',
      'Statuses and types include Incident, Change Request, Waiting on Customer, and so on. Members only see tickets on their projects.',
    ],
  },
  team: {
    title: 'Team',
    paragraphs: [
      'People in the organisation: invites, roles, line manager, and status.',
      'Search by name or email. Admins can filter by manager. Pending people need approval before they can sign in.',
      'Leave days are managed under Settings → Organisation. You cannot deactivate yourself. Removing someone lets you invite that email again.',
    ],
  },
  departments: {
    title: 'Departments',
    paragraphs: [
      'Departments group people for reporting. One person can be in several departments.',
      'They do not grant project access. Projects show up because those people are already on the project team.',
      'Archive a department when you no longer want it in reports. The line manager stays on Team.',
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
      'Hours, billable mix, budget burn, utilisation, Change Requests (CR tab), and (when you have rate access) money views.',
      'Summary includes top performance (approved hours, billable hours, or utilisation) by department and person, plus project/task billable breakdown.',
      'Utilisation uses a calendar month: approved tracked ÷ (planned hours − leave days × 8). Filter by department, person, manager, client, or project. Client/project only affect tracked hours.',
      'Revenue and profitability use approved time. Pick a date range (or a month on Utilisation), then use the tabs to switch report types.',
    ],
  },
  settings: {
    title: 'Settings',
    paragraphs: [
      'Your account: profile, password, and notification preferences.',
      'Organisation defaults (currency, manager margin visibility, monthly planned hours, and leave) appear when you manage the org or leave. Use Manage leave for a searchable, paginated people list. Admins edit capacity; admins and team managers edit leave for people they can manage.',
      'Personal settings are available to everyone; org sections stay permission-gated.',
    ],
  },
};
