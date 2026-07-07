import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  EmptyState,
  FormSection,
  Heading,
  Icon,
  Image,
  Inline,
  LinkButton,
  Lozenge,
  ProgressBar,
  Stack,
  Pressable,
  Tag,
  TagGroup,
  Text,
  TextArea,
  Textfield,
  User,
  useForm,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { STANDUP_LABELS_SHORT } from '../../lib/labels.js';
import { hadBlockerContent } from '../../lib/blockers.js';
import { allGroupedIssueKeys, groupStandupLinkedIssues } from '../../lib/standup-issues.js';
import { IssueHubFrame } from './IssueHubFrame.jsx';
import {
  extractJiraIssueKeys,
  parseJiraLinkPaste,
  parseStandupFieldParts,
  readTextareaValue,
  stripJiraLinkPasteContent,
} from '../../lib/adf-helpers.js';

const statusLozengeAppearance = (issue) => {
  const category = issue?.statusCategory ?? '';
  if (category === 'done') return 'success';
  if (category === 'indeterminate') return 'inprogress';
  return 'default';
};

export const enrichStandupIssues = async (issues) => {
  if (!issues?.length) return [];
  const keys = issues.map((issue) => issue.key);
  try {
    const result = await invoke('enrichLinkedIssues', { issueKeys: keys });
    const byKey = Object.fromEntries((result?.issues ?? []).map((issue) => [issue.key, issue]));
    return issues.map((issue) => ({
      ...issue,
      summary: byKey[issue.key]?.summary ?? issue.summary ?? '',
      status: byKey[issue.key]?.status ?? issue.status ?? '',
      statusCategory: byKey[issue.key]?.statusCategory ?? issue.statusCategory ?? 'new',
      issueType: byKey[issue.key]?.issueType ?? issue.issueType ?? '',
      issueTypeIconUrl: byKey[issue.key]?.issueTypeIconUrl ?? issue.issueTypeIconUrl ?? '',
    }));
  } catch {
    return issues;
  }
};

const STATUS_CYCLE = [
  { label: 'To do', color: 'color.text.subtle', dotColor: 'color.icon.subtle', category: 'new' },
  {
    label: 'In progress',
    color: 'color.text.information',
    dotColor: '#378ADD',
    category: 'indeterminate',
  },
  { label: 'Done', color: 'color.text.success', dotColor: '#639922', category: 'done' },
];

const getStatusDisplay = (issue) => {
  const category = issue?.statusCategory ?? 'new';
  const found = STATUS_CYCLE.find((s) => s.category === category);
  if (found) {
    return { ...found, label: issue?.status || found.label };
  }
  return {
    label: issue?.status || 'To do',
    color: 'color.text.subtle',
    dotColor: '#626f86',
    category: 'new',
  };
};

const getNextStatus = (currentCategory) => {
  const currentIdx = STATUS_CYCLE.findIndex((s) => s.category === currentCategory);
  const nextIdx = (currentIdx + 1) % STATUS_CYCLE.length;
  return STATUS_CYCLE[nextIdx];
};

/** Work item row — cùng layout với Custom UI backlog (Team Sync hôm nay). */
export const WorkItemRow = ({
  issue,
  onRemove,
  onStatusChange,
  draggable = false,
  onDragHandleProps,
  problemResolved = false,
}) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const statusDisplay = getStatusDisplay(issue);
  const statusLabel = statusDisplay.label;

  const handleStatusClick = () => {
    if (!onStatusChange) return;
    const currentCategory = issue?.statusCategory ?? 'new';
    const nextStatus = getNextStatus(currentCategory);
    onStatusChange(issue.key, nextStatus);
  };

  const handleRemove = () => {
    if (!onRemove) return;
    setIsRemoving(true);
    setTimeout(() => onRemove(issue.key), 200);
  };

  return (
    <Box
      backgroundColor="elevation.surface"
      padding="space.100"
      paddingInline="space.150"
      xcss={{
        borderRadius: 'radius.small',
        borderStyle: 'solid',
        borderWidth: 'border.width',
        borderColor: problemResolved ? 'color.border.success' : 'color.border',
        opacity: problemResolved ? '0.85' : isRemoving ? '0' : '1',
        transition: 'opacity 0.2s',
        minWidth: 0,
      }}
    >
      <Inline space="space.100" alignBlock="center" shouldWrap={false}>
        {draggable ? (
          <Box {...onDragHandleProps} xcss={{ cursor: 'grab' }}>
            <Text color="color.text.subtlest" aria-hidden="true">
              ⠿
            </Text>
          </Box>
        ) : null}

        <LinkButton href={`/browse/${issue.key}`} appearance="link">
          <Text
            size="small"
            color="color.text.subtle"
            as="span"
            xcss={{ fontFamily: 'ui-monospace, monospace', whiteSpace: 'nowrap' }}
          >
            {issue.key}
          </Text>
        </LinkButton>

        <Box grow="fill" xcss={{ minWidth: 0, overflow: 'hidden' }}>
          <LinkButton href={`/browse/${issue.key}`} appearance="link">
            <Text
              size="small"
              weight="medium"
              as="span"
              xcss={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {issue.summary || '—'}
            </Text>
          </LinkButton>
        </Box>

        {issue.issueType ? (
          <Box
            paddingBlock="space.050"
            paddingInline="space.100"
            backgroundColor="color.background.information"
            xcss={{ borderRadius: 'radius.small' }}
          >
            <Inline space="space.050" alignBlock="center">
              {issue.issueTypeIconUrl ? (
                <Image src={issue.issueTypeIconUrl} alt="" width={14} height={14} />
              ) : (
                <Text size="small" color="color.text.information" aria-hidden="true">
                  ☑
                </Text>
              )}
              <Text size="small" color="color.text.information" weight="medium">
                {issue.issueType}
              </Text>
            </Inline>
          </Box>
        ) : null}

        <Pressable onClick={handleStatusClick} isDisabled={!onStatusChange || problemResolved}>
          <Box
            paddingBlock="space.050"
            paddingInline="space.100"
            backgroundColor={problemResolved ? 'color.background.success' : 'elevation.surface'}
            xcss={{
              borderRadius: 'radius.full',
              borderStyle: 'solid',
              borderWidth: 'border.width',
              borderColor: problemResolved ? 'color.border.success' : 'color.border',
              cursor: onStatusChange && !problemResolved ? 'pointer' : 'default',
            }}
          >
            <Inline space="space.075" alignBlock="center">
              {problemResolved ? (
                <Text size="small" color="color.text.success" weight="medium">
                  ✓ Đã xử lý
                </Text>
              ) : (
                <>
                  <Box
                    xcss={{
                      width: '7px',
                      height: '7px',
                      borderRadius: 'radius.full',
                      backgroundColor: statusDisplay.dotColor,
                    }}
                  />
                  <Text size="small" color="color.text.subtle" weight="medium">
                    {statusLabel}
                  </Text>
                </>
              )}
            </Inline>
          </Box>
        </Pressable>

        {onRemove ? (
          <Pressable onClick={handleRemove}>
            <Box
              paddingBlock="space.075"
              paddingInline="space.100"
              xcss={{
                borderRadius: 'radius.small',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'color.background.danger',
                },
              }}
            >
              <Inline space="space.050" alignBlock="center">
                <Text size="small" aria-hidden="true">
                  🗑
                </Text>
                <Text size="small" color="color.text.subtle">
                  Gỡ
                </Text>
              </Inline>
            </Box>
          </Pressable>
        ) : null}
      </Inline>
    </Box>
  );
};

export const JiraIssueCompactRow = (props) => <WorkItemRow {...props} />;

/** @deprecated Dùng JiraIssueCompactRow */
export const JiraIssueSmartCard = ({ issue, onRemove }) => (
  <JiraIssueCompactRow issue={issue} onRemove={onRemove} />
);

/** Danh sách work item read-only — tách theo Tasks / Progress / Problems. */
export const GroupedWorkItemList = ({ entry, labels = STANDUP_LABELS_SHORT }) => {
  const groups = useMemo(() => groupStandupLinkedIssues(entry), [
    entry?.yesterday,
    entry?.today,
    entry?.blockers,
    entry?.linkedIssueKeys?.join(','),
    entry?.blockerIssueKey,
  ]);
  const allKeys = useMemo(() => allGroupedIssueKeys(groups), [groups]);
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!allKeys.length) {
      setIssues([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    enrichStandupIssues(allKeys.map((key) => ({ key, url: '' })))
      .then((enriched) => {
        if (!cancelled) setIssues(enriched);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [allKeys.join(',')]);

  if (!allKeys.length) return null;

  const blockerIssueKey = String(entry?.blockerIssueKey ?? '')
    .trim()
    .toUpperCase();
  const problemResolved = Boolean(entry?.blockerResolved);
  const byKey = Object.fromEntries(issues.map((issue) => [issue.key, issue]));
  const section = (variant, title, keys) => {
    if (!keys?.length) return null;
    const sectionIssues = keys.map((key) => byKey[key]).filter(Boolean);
    if (!sectionIssues.length && !loading) return null;
    const isProblems = variant === 'problems';
    return (
      <Stack key={variant} space="space.100">
        {isProblems ? (
          <Box
            padding="space.150"
            backgroundColor="color.background.accent.red.subtlest"
            xcss={{
              borderLeft: '4px solid',
              borderColor: 'color.border.accent.red',
              borderRadius: 'radius.medium',
            }}
          >
            <Stack space="space.075">
              <Inline space="space.075" alignBlock="center">
                <Text size="small" weight="bold">
                  Work item —{' '}
                  <Text as="span" size="small" weight="bold" color="color.text.danger">
                    {title}
                  </Text>
                </Text>
                {problemResolved ? <Tag text="Đã xử lý" color="green" /> : null}
              </Inline>
              {problemResolved ? (
                <Text size="small" color="color.text.subtle">
                  Vấn đề đã được đánh dấu xử lý
                </Text>
              ) : null}
            </Stack>
          </Box>
        ) : (
          <Text size="small" weight="bold">
            Work item — {title}
          </Text>
        )}
        <Box
          padding="space.200"
          backgroundColor="color.background.neutral"
          xcss={{ borderRadius: 'radius.medium' }}
        >
          <Stack space="space.100">
            {loading && !sectionIssues.length ? (
              <Text size="small" color="color.text.subtle">
                Đang tải work item…
              </Text>
            ) : null}
            {sectionIssues.map((issue) => (
              <WorkItemRow
                key={issue.key}
                issue={issue}
                problemResolved={
                  isProblems &&
                  problemResolved &&
                  (issue.key.toUpperCase() === blockerIssueKey || !blockerIssueKey)
                }
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    );
  };

  return (
    <Stack space="space.150">
      {section('tasks', labels.tasks, groups.tasks)}
      {section('progress', labels.progress, groups.progress)}
      {section('problems', labels.problems, groups.problems)}
    </Stack>
  );
};

/** Danh sách work item read-only — panel Backlog giống Team Sync hôm nay. */
export const WorkItemList = ({ issueKeys, title = 'Work item liên kết' }) => {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!issueKeys?.length) {
      setIssues([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    enrichStandupIssues(issueKeys.map((key) => ({ key, url: '' })))
      .then((enriched) => {
        if (!cancelled) setIssues(enriched);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [issueKeys.join(',')]);

  if (!issueKeys?.length) return null;

  return (
    <Stack space="space.100">
      {title ? (
        <Text size="small" color="color.text.subtle">
          {title}
        </Text>
      ) : null}
      <Box
        padding="space.200"
        backgroundColor="color.background.neutral"
        xcss={{ borderRadius: 'radius.medium' }}
      >
        <Stack space="space.100">
          {loading ? (
            <Text size="small" color="color.text.subtle">
              Đang tải work item…
            </Text>
          ) : null}
          {issues.map((issue) => (
            <WorkItemRow key={issue.key} issue={issue} />
          ))}
        </Stack>
      </Box>
    </Stack>
  );
};

export const JiraIssueSmartCardList = ({ issueKeys }) => (
  <WorkItemList issueKeys={issueKeys} title="" />
);

const isJiraBrowseUrlLine = (line) =>
  /^https?:\/\/[^\s>]+\/browse\/[A-Z][A-Z0-9]+-\d+\/?$/i.test(line.trim());

export const StandupFieldContent = ({ value, size = 'small', color }) => {
  const { text } = useMemo(() => parseStandupFieldParts(value), [value]);
  const keys = useMemo(() => extractJiraIssueKeys(value), [value]);
  const displayText = useMemo(() => {
    if (!text) return '';
    return text
      .split('\n')
      .filter((line) => !isJiraBrowseUrlLine(line))
      .join('\n')
      .trim();
  }, [text]);

  if (!displayText && !keys.length) return null;

  return (
    <Stack space="space.100">
      {displayText ? (
        <Text size={size} color={color}>
          {displayText}
        </Text>
      ) : null}
      {keys.length ? <JiraIssueSmartCardList issueKeys={keys} /> : null}
    </Stack>
  );
};

export const PageHeader = ({ title, subtitle, actions }) => (
  <Stack space="space.100">
    <Inline spread="space-between" alignBlock="start">
      <Stack space="space.050">
        <Heading as="h2">{title}</Heading>
        {subtitle ? (
          <Text color="color.text.subtle" size="small">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {actions ? <Inline space="space.100">{actions}</Inline> : null}
    </Inline>
  </Stack>
);

export const SurfaceCard = ({ children, padding = 'space.200' }) => (
  <Box padding={padding} backgroundColor="elevation.surface.raised">
    {children}
  </Box>
);

export const StatCard = ({ label, value, sub, progress, appearance }) => (
  <SurfaceCard>
    <Stack space="space.100">
      <Text size="small" color="color.text.subtle" weight="medium">
        {label}
      </Text>
      <Text
        size="xlarge"
        weight="bold"
        color={appearance ? `color.text.${appearance}` : undefined}
      >
        {value}
      </Text>
      {typeof progress === 'number' ? <ProgressBar value={Math.min(100, Math.max(0, progress))} /> : null}
      {sub ? (
        <Text size="small" color="color.text.subtle">
          {sub}
        </Text>
      ) : null}
    </Stack>
  </SurfaceCard>
);

export const StandupField = ({
  step,
  label,
  hint,
  placeholder,
  fieldId,
  registerProps,
  minimumRows = 3,
}) => (
  <FormSection title={step ? `${step}. ${label}` : label} description={hint}>
    <TextArea
      {...registerProps}
      id={fieldId}
      minimumRows={minimumRows}
      placeholder={placeholder}
    />
  </FormSection>
);

const syncFormField = (fieldProps, setValue, name, value) => {
  setValue(name, value);
  fieldProps.onChange?.({ target: { value } });
};

export const StandupLinkedIssuesEditor = ({
  projectKey,
  issues = [],
  lockedKeys = [],
  onAddIssues,
  onRemoveIssue,
  onReorderIssues,
  onStatusChange,
  maxIssues = 20,
}) => (
  <IssueHubFrame
    projectKey={projectKey}
    issues={issues}
    lockedKeys={lockedKeys}
    maxIssues={maxIssues}
    enableReorder={Boolean(onReorderIssues)}
    enableStatusChange={Boolean(onStatusChange)}
    onAddIssues={onAddIssues}
    onRemoveIssue={onRemoveIssue}
    onReorderIssues={onReorderIssues}
    onStatusChange={onStatusChange}
  />
);

export const EmptyPrompt = ({ header, description, actionLabel, onAction }) => (
  <EmptyState
    header={header}
    description={description}
    primaryAction={
      actionLabel && onAction ? (
        <Button appearance="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : undefined
    }
  />
);

export const memberInitials = (name) =>
  (name ?? '?')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const MEMBER_AVATAR_BG = [
  'color.background.accent.blue.bolder',
  'color.background.accent.green.bolder',
  'color.background.accent.orange.bolder',
  'color.background.accent.purple.bolder',
  'color.background.accent.red.bolder',
  'color.background.accent.lime.bolder',
];

export const memberAvatarBg = (accountId) => {
  const s = accountId ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % MEMBER_AVATAR_BG.length;
  return MEMBER_AVATAR_BG[h];
};

/** Avatar tròn chữ cái — giống mockup team, không khung bọc ngoài. */
export const MemberInitialsAvatar = ({ accountId, displayName, size = 'medium' }) => {
  const pad = size === 'large' ? 'space.150' : 'space.100';
  const textSize = size === 'large' ? 'medium' : 'small';
  return (
    <Box
      padding={pad}
      backgroundColor={memberAvatarBg(accountId)}
      xcss={{ borderRadius: 'radius.full' }}
    >
      <Text weight="bold" size={textSize} color="color.text.inverse" align="center">
        {memberInitials(displayName)}
      </Text>
    </Box>
  );
};

/** Avatar Jira (ưu tiên) — fallback chữ cái khi không có accountId; không bọc khung màu. */
export const UserAvatar = ({ accountId, displayName }) =>
  accountId ? (
    <User accountId={accountId} hideDisplayName />
  ) : (
    <MemberInitialsAvatar accountId={accountId} displayName={displayName} />
  );

export const splitStandupLines = (text) =>
  (text ?? '')
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

const UPDATE_ROW_VARIANT = {
  done: {
    icon: 'check-mark',
    iconColor: 'color.icon.success',
    labelColor: 'color.text.success',
    bg: 'color.background.accent.green.subtlest',
    accent: 'color.border.accent.green',
  },
  plan: {
    icon: 'clock',
    iconColor: 'color.icon.information',
    labelColor: 'color.text.information',
    bg: 'color.background.accent.blue.subtlest',
    accent: 'color.border.accent.blue',
  },
  blocker: {
    icon: 'status-warning',
    iconColor: 'color.icon.warning',
    labelColor: 'color.text.danger',
    textColor: 'color.text.danger',
    bg: 'color.background.accent.red.subtlest',
    accent: 'color.border.accent.red',
  },
};

const StandupUpdateRow = ({ variant, label, text, resolved = false, resolution = '' }) => {
  const content = (text ?? '').trim();
  if (!content) return null;
  const style = UPDATE_ROW_VARIANT[variant] ?? UPDATE_ROW_VARIANT.done;

  return (
    <Inline alignBlock="stretch" space="space.0" grow="fill">
      <Box
        backgroundColor={resolved ? 'color.border.accent.red' : style.accent}
        xcss={{
          width: '4px',
          borderTopLeftRadius: 'radius.small',
          borderBottomLeftRadius: 'radius.small',
        }}
      />
      <Box
        grow="fill"
        padding="space.150"
        backgroundColor={resolved ? 'color.background.accent.red.subtlest' : style.bg}
        xcss={{
          borderTopRightRadius: 'radius.medium',
          borderBottomRightRadius: 'radius.medium',
          height: '100%',
        }}
      >
        <Stack space="space.025">
          <Inline space="space.075" alignBlock="center">
            <Icon glyph={style.icon} label="" color={style.iconColor} />
            <Text size="small" weight="bold" color="color.text">
              {label.toUpperCase()}
            </Text>
            {resolved ? (
              <Tag text="Đã xử lý" color="green" />
            ) : null}
          </Inline>
          <StandupFieldContent value={text} size="small" color={resolved ? 'color.text.subtle' : style.textColor} />
          {resolved && resolution?.trim() ? (
            <Text size="small" color="color.text.subtle">
              <Text as="span" weight="bold" color="color.text">
                Phương án:{' '}
              </Text>
              {resolution}
            </Text>
          ) : null}
        </Stack>
      </Box>
    </Inline>
  );
};

export const StandupUpdateSections = ({
  yesterday,
  today,
  blockers,
  hasBlocker,
  blockerResolved = false,
  blockerResolution = '',
  labels,
  emptyMessage,
}) => {
  const L = labels ?? STANDUP_LABELS_SHORT;
  const doneText = (yesterday ?? '').trim();
  const planText = (today ?? '').trim();
  const blockerText = (blockers ?? '').trim();
  const showResolvedBlocker = blockerResolved && hadBlockerContent(blockers);

  const sections = [
    doneText ? { variant: 'done', label: L.tasks, text: doneText } : null,
    planText ? { variant: 'plan', label: L.progress, text: planText } : null,
    hasBlocker ? { variant: 'blocker', label: L.problems, text: blockerText } : null,
    showResolvedBlocker
      ? {
          variant: 'blocker',
          label: L.problems,
          text: blockerText,
          resolved: true,
          resolution: blockerResolution,
        }
      : null,
  ].filter(Boolean);

  if (!sections.length) {
    return emptyMessage ? (
      <Text size="small" color="color.text.subtle">
        {emptyMessage}
      </Text>
    ) : null;
  }

  return (
    <Inline space="space.075" alignBlock="stretch" shouldWrap grow="fill">
      {sections.map((section) => (
        <Box key={section.variant} grow="fill">
          <StandupUpdateRow {...section} />
        </Box>
      ))}
    </Inline>
  );
};

/** @deprecated Dùng StandupUpdateSections — giữ API cũ cho tương thích. */
export const StandupContentBlock = ({ label, value, variant = 'done' }) => (
  <StandupUpdateRow variant={variant} label={label} text={value} />
);

export const StandupEntryHeader = ({ accountId, displayName, createdAt, extra }) => (
  <Inline spread="space-between" alignBlock="center">
    <Inline space="space.100" alignBlock="center">
      <UserAvatar accountId={accountId} displayName={displayName} />
      <Stack space="space.025">
        <Text weight="semibold">{displayName}</Text>
        {createdAt ? (
          <Text size="small" color="color.text.subtle">
            Ghi lúc{' '}
            {new Date(createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : null}
      </Stack>
    </Inline>
    {extra ?? null}
  </Inline>
);

export const StandupEntryBody = ({ yesterday, today, blockers, hasBlocker, labels }) => (
  <StandupUpdateSections
    yesterday={yesterday}
    today={today}
    blockers={blockers}
    hasBlocker={hasBlocker}
    labels={labels}
  />
);

export const StandupTimelineCard = ({ entry, labels, headerExtra, footer }) => (
  <SurfaceCard padding="space.200">
    <Stack space="space.150">
      <StandupEntryHeader
        accountId={entry.accountId}
        displayName={entry.displayName}
        createdAt={entry.createdAt}
        extra={headerExtra}
      />
      <StandupEntryBody
        yesterday={entry.yesterday}
        today={entry.today}
        blockers={entry.blockers}
        hasBlocker={entry.hasBlocker}
        labels={labels}
      />
      {footer ?? null}
    </Stack>
  </SurfaceCard>
);

export const TimelineField = ({ label, value, isBlocker }) => (
  <Stack space="space.025">
    <Text size="small" weight="semibold" color="color.text.subtle">
      {label}
    </Text>
    <Text size="small" color={isBlocker ? 'color.text.danger' : undefined}>
      {value}
    </Text>
  </Stack>
);

export const MemberChip = ({ accountId, name, loggedToday }) => (
  <SurfaceCard padding="space.150">
    <Inline space="space.150" alignBlock="center">
      <UserAvatar accountId={accountId} displayName={name} />
      <Stack space="space.025">
        <Text weight="semibold" size="small">
          {name}
        </Text>
        <Lozenge appearance={loggedToday ? 'success' : 'default'}>
          {loggedToday ? 'Đã ghi Team Sync hôm nay' : 'Chưa ghi hôm nay'}
        </Lozenge>
      </Stack>
    </Inline>
  </SurfaceCard>
);

const MEMBER_ACCENTS = [
  'color.background.accent.blue.subtle',
  'color.background.accent.green.subtle',
  'color.background.accent.orange.subtle',
  'color.background.accent.lime.subtle',
  'color.background.accent.purple.subtle',
  'color.background.accent.red.subtle',
];

export const memberAccentColor = (accountId) => {
  const s = accountId ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % MEMBER_ACCENTS.length;
  return MEMBER_ACCENTS[h];
};

export const MemberSelectCard = ({ accountId, name, loggedToday, selected, onSelect }) => (
  <Pressable onClick={onSelect}>
    <Box
      padding="space.200"
      backgroundColor="elevation.surface.raised"
      xcss={{
        borderRadius: 'radius.medium',
        borderStyle: 'solid',
        borderWidth: selected ? 'border.width.focused' : 'border.width',
        borderColor: selected ? 'color.border.selected' : 'color.border',
        minWidth: '128px',
      }}
    >
      <Stack space="space.150">
        <Inline alignBlock="center" alignInline="center">
          <UserAvatar accountId={accountId} displayName={name} />
        </Inline>
        <Text weight="semibold" align="center">
          {name}
        </Text>
        <Text
          size="small"
          align="center"
          color={loggedToday ? 'color.text.success' : 'color.text.danger'}
        >
          {loggedToday ? 'Đã ghi hôm nay' : 'Chưa ghi'}
        </Text>
        <ProgressBar value={loggedToday ? 100 : 0} />
      </Stack>
    </Box>
  </Pressable>
);

export const IssueTagGroup = ({ keys }) => {
  if (!keys?.length) return null;
  return (
    <TagGroup>
      {keys.map((key) => (
        <Tag key={key} text={key} color="blue" href={`/browse/${key}`} />
      ))}
    </TagGroup>
  );
};

export const DashboardUpdateCard = ({ entry, canAdminister, onOpenResolveModal }) => {
  const labels = STANDUP_LABELS_SHORT;
  const time = entry.createdAt
    ? new Date(entry.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : null;

  return (
    <SurfaceCard padding="space.250">
      <Stack space="space.200">
        <Inline spread="space-between" alignBlock="center">
          <Inline space="space.100" alignBlock="center">
            <UserAvatar accountId={entry.accountId} displayName={entry.displayName} />
            <Text weight="semibold">{entry.displayName}</Text>
          </Inline>
          {time ? (
            <Text size="small" color="color.text.subtle">
              {time}
            </Text>
          ) : null}
        </Inline>

        <Box
          padding="space.200"
          backgroundColor="elevation.surface.sunken"
          xcss={{
            borderRadius: 'radius.medium',
            borderStyle: 'solid',
            borderWidth: 'border.width',
            borderColor: 'color.border',
          }}
        >
          <StandupUpdateSections
            yesterday={entry.yesterday}
            today={entry.today}
            blockers={entry.blockers}
            hasBlocker={entry.hasBlocker}
            blockerResolved={entry.blockerResolved}
            blockerResolution={entry.blockerResolution}
            labels={labels}
            emptyMessage="Chưa có nội dung."
          />
        </Box>

        {allGroupedIssueKeys(groupStandupLinkedIssues(entry)).length ? (
          <GroupedWorkItemList entry={entry} labels={labels} />
        ) : null}

        {entry.hasBlocker && canAdminister && onOpenResolveModal ? (
          <Button appearance="default" shouldFitContainer onClick={() => onOpenResolveModal(entry)}>
            Đánh dấu đã xử lý vấn đề
          </Button>
        ) : null}
      </Stack>
    </SurfaceCard>
  );
};

export const HistoryEntryCard = ({ entry, labels, footer }) => (
  <StandupTimelineCard
    entry={{
      accountId: entry.accountId,
      displayName: entry.displayName,
      createdAt: entry.createdAt,
      yesterday: entry.yesterday,
      today: entry.today,
      blockers: entry.blockers,
      hasBlocker: entry.hasBlocker,
    }}
    labels={labels}
    headerExtra={
      entry.dateDisplay ? (
        <Text size="small" color="color.text.subtle">
          {entry.dateDisplay}
        </Text>
      ) : null
    }
    footer={
      footer ??
      (allGroupedIssueKeys(groupStandupLinkedIssues(entry)).length ? (
        <GroupedWorkItemList entry={entry} labels={labels} />
      ) : null)
    }
  />
);
