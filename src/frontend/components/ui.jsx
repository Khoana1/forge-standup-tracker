import React from 'react';
import {
  Box,
  Button,
  EmptyState,
  FormSection,
  Heading,
  Icon,
  Inline,
  Lozenge,
  ProgressBar,
  Stack,
  Pressable,
  Tag,
  TagGroup,
  Text,
  TextArea,
  User,
} from '@forge/react';
import { STANDUP_LABELS_SHORT } from '../../lib/labels.js';

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

const StandupUpdateRow = ({ variant, label, text }) => {
  const content = (text ?? '').trim();
  if (!content) return null;
  const style = UPDATE_ROW_VARIANT[variant] ?? UPDATE_ROW_VARIANT.done;

  return (
    <Inline alignBlock="stretch" space="space.0" grow="fill">
      <Box
        backgroundColor={style.accent}
        xcss={{
          width: '4px',
          borderTopLeftRadius: 'radius.small',
          borderBottomLeftRadius: 'radius.small',
        }}
      />
      <Box
        grow="fill"
        padding="space.150"
        backgroundColor={style.bg}
        xcss={{
          borderTopRightRadius: 'radius.medium',
          borderBottomRightRadius: 'radius.medium',
          height: '100%',
        }}
      >
        <Stack space="space.025">
          <Inline space="space.075" alignBlock="center">
            <Icon glyph={style.icon} label="" color={style.iconColor} />
            <Text size="small" weight="bold" color={style.labelColor}>
              {label.toUpperCase()}
            </Text>
          </Inline>
          <Text size="small" color={style.textColor}>
            {content}
          </Text>
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
  labels,
  emptyMessage,
}) => {
  const L = labels ?? STANDUP_LABELS_SHORT;
  const doneText = (yesterday ?? '').trim();
  const planText = (today ?? '').trim();

  const sections = [
    doneText ? { variant: 'done', label: L.tasks, text: doneText } : null,
    planText ? { variant: 'plan', label: L.progress, text: planText } : null,
    hasBlocker ? { variant: 'blocker', label: L.problems, text: blockers } : null,
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
          color={loggedToday ? 'color.text.subtle' : 'color.text.danger'}
        >
          {loggedToday ? 'Đã ghi hôm nay' : 'Chưa ghi'}
        </Text>
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
            labels={labels}
            emptyMessage="Chưa có nội dung."
          />
        </Box>

        {entry.linkedIssueKeys?.length ? (
          <Inline space="space.075" alignBlock="center">
            <Text size="small" color="color.text.subtle">
              Liên kết:
            </Text>
            <IssueTagGroup keys={entry.linkedIssueKeys} />
          </Inline>
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
      (entry.linkedIssueKeys?.length ? (
        <Text size="small" color="color.text.subtle">
          Issue liên kết: {entry.linkedIssueKeys.join(', ')}
        </Text>
      ) : null)
    }
  />
);
