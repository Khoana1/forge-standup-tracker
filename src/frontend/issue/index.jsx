import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Form,
  FormFooter,
  Heading,
  Inline,
  LoadingButton,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  useForm,
  useProductContext,
} from '@forge/react';
import { invoke, router } from '@forge/bridge';
import { todayIso, isoToDisplay } from '../../lib/dates.js';
import {
  STANDUP_HINTS,
  STANDUP_LABELS_SHORT,
  STANDUP_PLACEHOLDER,
  UI_COPY,
  formatTeamSyncTitle,
} from '../../lib/labels.js';
import {
  PageHeader,
  StandupField,
  StandupTimelineCard,
  SurfaceCard,
} from '../components/ui.jsx';

const IssueChip = ({ issue, onRemove }) => (
  <SurfaceCard padding="space.100">
    <Inline space="space.100" alignBlock="center">
      <Button appearance="link" spacing="none" onClick={() => router.open(`/browse/${issue.key}`)}>
        {issue.key}
      </Button>
      <Text size="small">{issue.summary || '—'}</Text>
      {issue.status ? <Lozenge>{issue.status}</Lozenge> : null}
      {onRemove ? (
        <Button appearance="subtle" spacing="none" onClick={() => onRemove(issue.key)}>
          Gỡ
        </Button>
      ) : null}
    </Inline>
  </SurfaceCard>
);

const IssueStandupPanel = () => {
  const context = useProductContext();
  const issueKey = context?.extension?.issue?.key;
  const projectKey = context?.extension?.project?.key;

  const { handleSubmit, register, getFieldId, setValue, formState } = useForm({
    defaultValues: { blockers: STANDUP_PLACEHOLDER.problems },
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [linkedIssues, setLinkedIssues] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);
  const [todayEntry, setTodayEntry] = useState(null);
  const [sprintName, setSprintName] = useState(null);

  useEffect(() => {
    if (!projectKey) return;
    invoke('getAppStatus', { projectKey })
      .then(({ activeSprint }) => setSprintName(activeSprint?.name ?? null))
      .catch(() => {});
  }, [projectKey]);

  const load = useCallback(async () => {
    if (!projectKey || !issueKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [historyResult, todayResult] = await Promise.all([
        invoke('getIssueStandupHistory', { projectKey, issueKey }),
        invoke('getMyStandupToday', { projectKey, date: todayIso() }),
      ]);
      setHistory(historyResult?.entries ?? []);
      const entry = todayResult?.entry;
      setTodayEntry(entry);
      setLoggedToday(Boolean(entry));
      if (entry) {
        setValue('yesterday', entry.yesterday);
        setValue('today', entry.today);
        setValue('blockers', entry.blockers);
        const keys = entry.linkedIssueKeys ?? [];
        if (keys.length) {
          const enriched = await invoke('enrichLinkedIssues', { issueKeys: keys });
          setLinkedIssues(
            enriched?.issues ?? keys.map((k) => ({ key: k, summary: '', status: '' }))
          );
        }
      } else {
        setLinkedIssues([
          { key: issueKey, summary: context?.extension?.issue?.summary ?? '', status: '' },
        ]);
      }
    } catch (e) {
      setError(e?.message ?? 'Không tải được dữ liệu issue.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, issueKey, setValue, context?.extension?.issue?.summary]);

  useEffect(() => {
    load();
  }, [load]);

  const searchIssues = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const result = await invoke('searchIssuesForLink', {
        projectKey,
        query: searchQuery.trim(),
      });
      setSuggestions(result?.issues ?? []);
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  };

  const addIssue = (issue) => {
    if (linkedIssues.some((i) => i.key === issue.key)) return;
    setLinkedIssues((prev) => [...prev, issue]);
    setSearchQuery('');
    setSuggestions([]);
  };

  const removeIssue = (key) => {
    setLinkedIssues((prev) => prev.filter((i) => i.key !== key));
  };

  const onSubmit = async (data) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await invoke('submitIssueStandup', {
        projectKey,
        contextIssueKey: issueKey,
        linkedIssueKeys: linkedIssues.map((i) => i.key),
        yesterday: data.yesterday,
        today: data.today,
        blockers: data.blockers,
        date: todayIso(),
      });
      setMessage('Đã lưu Team Sync. Issue này được liên kết tự động.');
      setLoggedToday(true);
      await load();
    } catch (e) {
      setError(e?.message ?? 'Không lưu được Team Sync.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!projectKey || !issueKey) {
    return (
      <SectionMessage appearance="warning" title="Cần mở từ issue">
        <Text>Thêm panel «Team Sync» trên màn hình issue để ghi báo cáo hàng ngày.</Text>
      </SectionMessage>
    );
  }

  if (loading) return <Spinner label="Đang tải…" />;

  return (
    <Stack space="space.250">
      <PageHeader
        title={`${formatTeamSyncTitle(sprintName)} · ${issueKey}`}
        subtitle={UI_COPY.teamSyncSubtitle}
      />

      <Inline space="space.100" alignBlock="center">
        <Lozenge appearance={loggedToday ? 'success' : 'removed'}>
          {loggedToday ? 'Đã ghi hôm nay' : 'Chưa ghi hôm nay'}
        </Lozenge>
        {todayEntry?.createdAt ? (
          <Text size="small" color="color.text.subtle">
            Lúc{' '}
            {new Date(todayEntry.createdAt).toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        ) : null}
      </Inline>

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {message ? <SectionMessage appearance="success">{message}</SectionMessage> : null}

      {!loggedToday ? (
        <SectionMessage appearance="information">
          <Text>Issue hiện tại sẽ được liên kết tự động khi bạn gửi Team Sync.</Text>
        </SectionMessage>
      ) : null}

      <Form onSubmit={handleSubmit(onSubmit)}>
        <Stack space="space.200">
          <StandupField
            step={1}
            label={STANDUP_LABELS_SHORT.tasks}
            hint={STANDUP_HINTS.tasks}
            placeholder={STANDUP_PLACEHOLDER.tasks}
            fieldId={getFieldId('yesterday')}
            registerProps={register('yesterday', { required: true })}
            minimumRows={2}
          />
          <StandupField
            step={2}
            label={STANDUP_LABELS_SHORT.progress}
            hint={STANDUP_HINTS.progress}
            placeholder={STANDUP_PLACEHOLDER.progress}
            fieldId={getFieldId('today')}
            registerProps={register('today', { required: true })}
            minimumRows={2}
          />
          <StandupField
            step={3}
            label={STANDUP_LABELS_SHORT.problems}
            hint={STANDUP_HINTS.problems}
            placeholder={STANDUP_PLACEHOLDER.problems}
            fieldId={getFieldId('blockers')}
            registerProps={register('blockers', { required: true })}
            minimumRows={2}
          />

          <Box>
            <Stack space="space.100">
              <Heading as="h4">Issue liên kết</Heading>
              <Text size="small" color="color.text.subtle">
                Thêm issue khác liên quan đến công việc hôm nay của bạn.
              </Text>
              <Stack space="space.075">
                {linkedIssues.map((issue) => (
                  <IssueChip
                    key={issue.key}
                    issue={issue}
                    onRemove={issue.key !== issueKey ? removeIssue : undefined}
                  />
                ))}
              </Stack>
              <Inline space="space.100">
                <Textfield
                  value={searchQuery}
                  onChange={(value) => setSearchQuery(value)}
                  placeholder="Nhập mã issue hoặc từ khóa tiêu đề…"
                />
                <Button appearance="default" onClick={searchIssues} isDisabled={searching}>
                  {searching ? '…' : 'Tìm'}
                </Button>
              </Inline>
              {suggestions.length ? (
                <Stack space="space.050">
                  {suggestions.map((issue) => (
                    <Button key={issue.key} appearance="subtle" onClick={() => addIssue(issue)}>
                      {issue.key} — {issue.summary}
                    </Button>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Box>

          <FormFooter align="start">
            <LoadingButton
              type="submit"
              appearance="primary"
              isLoading={submitting}
              isDisabled={!formState.isValid}
            >
              {loggedToday ? 'Cập nhật Team Sync' : 'Gửi Team Sync hôm nay'}
            </LoadingButton>
          </FormFooter>
        </Stack>
      </Form>

      {history.length ? (
        <Stack space="space.150">
          <Heading as="h4">Team Sync trước đó (issue này)</Heading>
          {history.map((entry) => {
            const hasBlocker =
              entry.blockers &&
              !['none', 'không có', 'khong co'].includes(entry.blockers.trim().toLowerCase());
            return (
              <StandupTimelineCard
                key={`${entry.date}-${entry.accountId}`}
                entry={{
                  accountId: entry.accountId,
                  displayName: entry.displayName,
                  yesterday: entry.yesterday,
                  today: entry.today,
                  blockers: entry.blockers,
                  hasBlocker,
                }}
                labels={STANDUP_LABELS_SHORT}
                headerExtra={
                  <Text size="small" color="color.text.subtle">
                    {isoToDisplay(entry.date)}
                  </Text>
                }
              />
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <IssueStandupPanel />
  </React.StrictMode>
);
