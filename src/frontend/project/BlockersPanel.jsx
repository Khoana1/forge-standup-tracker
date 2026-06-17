import React, { useMemo, useState } from 'react';
import {
  Button,
  Inline,
  Lozenge,
  SectionMessage,
  Stack,
  Text,
} from '@forge/react';
import { router } from '@forge/bridge';
import { isoToDisplay } from '../../lib/dates.js';
import { EmptyPrompt, SurfaceCard, UserAvatar } from '../components/ui.jsx';

const TYPE_LOZENGE = {
  infrastructure: 'moved',
  access: 'default',
  review: 'new',
  external: 'removed',
  other: 'default',
};

const FILTER_ALL = 'all';
const FILTER_TODAY = 'today';
const FILTER_STALE = 'stale';

const IssuePills = ({ keys }) => {
  if (!keys?.length) return null;
  return (
    <Inline space="space.050">
      {keys.map((key) => (
        <Button
          key={key}
          appearance="link"
          spacing="none"
          onClick={() => router.open(`/browse/${key}`)}
        >
          {key}
        </Button>
      ))}
    </Inline>
  );
};

const ageLabel = (blocker) => {
  if (blocker.isToday) return 'Hôm nay';
  if (blocker.ageDays === 1) return 'Hôm qua';
  return `${blocker.ageDays} ngày trước`;
};

const BlockerCard = ({ blocker, canAdminister, resolving, onResolve }) => (
  <SurfaceCard padding="space.150">
    <Stack space="space.100">
      <Inline space="space.100">
        <Lozenge appearance={TYPE_LOZENGE[blocker.type] ?? 'default'}>{blocker.typeLabel}</Lozenge>
        {blocker.isStale ? <Lozenge appearance="removed">Quá hạn</Lozenge> : null}
        {blocker.isToday && !blocker.isStale ? <Lozenge appearance="success">Mới</Lozenge> : null}
      </Inline>
      <Text>{blocker.blockers}</Text>
      <Inline space="space.100" alignBlock="center">
        <UserAvatar accountId={blocker.accountId} displayName={blocker.displayName} />
        <Text size="small" color="color.text.subtle">
          {blocker.displayName} · {isoToDisplay(blocker.date)} · {ageLabel(blocker)}
        </Text>
      </Inline>
      <IssuePills keys={blocker.linkedIssueKeys} />
      {canAdminister ? (
        <Button
          appearance="default"
          spacing="compact"
          isDisabled={resolving === blocker.key}
          onClick={() => onResolve(blocker)}
        >
          {resolving === blocker.key ? 'Đang lưu…' : 'Đánh dấu đã xử lý'}
        </Button>
      ) : null}
    </Stack>
  </SurfaceCard>
);

export const BlockersPanel = ({
  blockers = [],
  summary = {},
  canAdminister,
  resolving,
  onResolve,
}) => {
  const [filter, setFilter] = useState(FILTER_ALL);

  const filtered = useMemo(() => {
    if (filter === FILTER_TODAY) return blockers.filter((b) => b.isToday);
    if (filter === FILTER_STALE) return blockers.filter((b) => b.isStale);
    return blockers;
  }, [blockers, filter]);

  if (!blockers.length) {
    return (
      <SectionMessage appearance="success" title="Không có khó khăn đang mở">
        <Text>Team không báo cáo vấn đề nào. Problems mới sẽ hiện tại đây khi có trong Team Sync.</Text>
      </SectionMessage>
    );
  }

  const filters = [
    { id: FILTER_ALL, label: `Tất cả (${summary.total ?? blockers.length})` },
    { id: FILTER_TODAY, label: `Hôm nay (${summary.today ?? 0})` },
    { id: FILTER_STALE, label: `Quá hạn (${summary.stale ?? 0})` },
  ];

  return (
    <Stack space="space.150">
      {(summary.stale ?? 0) > 0 ? (
        <SectionMessage appearance="warning" title="Có khó khăn quá hạn">
          <Text>
            {summary.stale} mục chưa xử lý lâu — nên thảo luận trong buổi Team Sync hoặc đánh dấu đã
            xử lý.
          </Text>
        </SectionMessage>
      ) : null}

      <Inline space="space.100">
        {filters.map((f) => (
          <Button
            key={f.id}
            appearance={filter === f.id ? 'primary' : 'subtle'}
            spacing="compact"
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </Button>
        ))}
      </Inline>

      {filtered.length === 0 ? (
        <Text color="color.text.subtle">Không có khó khăn trong nhóm lọc này.</Text>
      ) : (
        filtered.map((blocker) => (
          <BlockerCard
            key={blocker.key}
            blocker={blocker}
            canAdminister={canAdminister}
            resolving={resolving}
            onResolve={onResolve}
          />
        ))
      )}

      {!canAdminister ? (
        <Text size="small" color="color.text.subtle">
          Chỉ project admin mới đánh dấu khó khăn đã xử lý.
        </Text>
      ) : null}
    </Stack>
  );
};

export default BlockersPanel;
