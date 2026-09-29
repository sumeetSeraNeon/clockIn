'use client';

import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div>
      <PageHeader
        title={title}
        description="This screen will follow the Clients template once we build that domain."
      />
      <EmptyState
        title={`No ${title.toLowerCase()} UI yet`}
        description="The app shell is ready. Feature screens land next — starting with Clients as the reusable pattern."
      />
    </div>
  );
}
