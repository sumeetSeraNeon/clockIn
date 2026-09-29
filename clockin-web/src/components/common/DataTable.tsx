import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type DataTableColumn<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export type DataTableGroup<T> = {
  id: string;
  label: string;
  hint?: string;
  rows: T[];
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows?: T[];
  /** Optional manager/section groups — one flat table with header rows. */
  groups?: DataTableGroup<T>[];
  rowKey: (row: T) => string;
  className?: string;
};

/** Flat spreadsheet table — no card chrome. */
export function DataTable<T>({
  columns,
  rows,
  groups,
  rowKey,
  className,
}: DataTableProps<T>) {
  const sections: DataTableGroup<T>[] =
    groups && groups.length > 0
      ? groups
      : [{ id: 'all', label: '', rows: rows ?? [] }];

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-navy/15">
            {columns.map((col) => (
              <th
                key={col.id}
                className={cn(
                  'px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-navy/55',
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map((section) => (
            <Fragment key={section.id}>
              {section.label ? (
                <tr className="border-b border-navy/10">
                  <td
                    colSpan={columns.length}
                    className="bg-navy/[0.03] px-3 py-2"
                  >
                    <span className="text-sm font-semibold text-navy">
                      {section.label}
                    </span>
                    {section.hint ? (
                      <span className="ml-2 text-xs text-slate">
                        {section.hint}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ) : null}
              {section.rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-navy/[0.08] transition-colors hover:bg-navy/[0.03]"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={cn('px-3 py-3 text-navy', col.className)}
                    >
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
