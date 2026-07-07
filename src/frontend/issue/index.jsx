import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
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
  useForm,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { todayIso, isoToDisplay } from '../../lib/dates.js';
import {
  STANDUP_HINTS,
  STANDUP_LABELS_SHORT,
  STANDUP_PLACEHOLDER,
  UI_COPY,
  formatTeamSyncTitle,
} from '../../lib/labels.js';
import { extractPlainText, serializeStandupText } from '../../lib/adf-helpers.js';
import { useStandupForm } from '../hooks/useStandupForm.js';
import {
  PageHeader,
  StandupField,
  StandupLinkedIssuesEditor,
  StandupTimelineCard,
} from '../components/ui.jsx';

const hasRealBlocker = (text) => {
  const lower = extractPlainText(text).toLowerCase();
  return lower.length > 0 && !['none', 'không có', 'khong co', 'n/a'].includes(lower);
};

const IssueStandupPanel = () => {
  const context = useProductContext();
  const issueKey = context?.extension?.issue?.key;
  const projectKey = context?.extension?.project?.key;

  const { handleSubmit, register, setValue } = useForm({
    defaultValues: {
      yesterday: '',
      today: '',
      blockers: STANDUP_PLACEHOLDER.problems,
    },
  });
  const {
    addLinkedIssues,
    bindField,
    canSubmit,
    linkedIssueKeys,
    linkedIssues,
    loadEntry,
    removeLinkedIssue,
    reorderLinkedIssues,
    updateIssueStatus,
  } = useStandupForm({
    register,
    setValue,
    defaultBlockers: STANDUP_PLACEHOLDER.problems,
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
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
        await loadEntry(entry);
      } else {
        await addLinkedIssues([
          {
            key: issueKey,
            url: '',
            summary: context?.extension?.issue?.summary ?? '',
            status: '',
          },
        ]);
      }
    } catch (e) {
      setError(e?.message ?? 'Không tải được dữ liệu issue.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, issueKey, loadEntry, addLinkedIssues, context?.extension?.issue?.summary]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = handleSubmit(async (data) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await invoke('submitIssueStandup', {
        projectKey,
        contextIssueKey: issueKey,
        linkedIssueKeys: [...new Set([issueKey, ...linkedIssueKeys])],
        yesterday: serializeStandupText(data.yesterday),
        today: serializeStandupText(data.today),
        blockers: serializeStandupText(data.blockers),
        date: todayIso(),
      });
      if (result?.problemNotification?.sent > 0) {
        setMessage(
          'Đã lưu Team Sync. Đã gửi email thông báo cho quản trị project. Issue này được liên kết tự động.'
        );
      } else {
        setMessage('Đã lưu Team Sync. Issue này được liên kết tự động.');
      }
      setLoggedToday(true);
      await load();
    } catch (e) {
      setError(e?.message ?? 'Không lưu được Team Sync.');
    } finally {
      setSubmitting(false);
    }
  });

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

      <Form onSubmit={onSubmit}>
        <Stack space="space.200">
          <StandupField
            step={1}
            label={STANDUP_LABELS_SHORT.tasks}
            hint={STANDUP_HINTS.tasks}
            placeholder={STANDUP_PLACEHOLDER.tasks}
            registerProps={bindField('yesterday')}
            minimumRows={2}
          />
          <StandupField
            step={2}
            label={STANDUP_LABELS_SHORT.progress}
            hint={STANDUP_HINTS.progress}
            placeholder={STANDUP_PLACEHOLDER.progress}
            registerProps={bindField('today')}
            minimumRows={2}
          />
          <StandupField
            step={3}
            label={STANDUP_LABELS_SHORT.problems}
            hint={STANDUP_HINTS.problems}
            placeholder={STANDUP_PLACEHOLDER.problems}
            registerProps={bindField('blockers')}
            minimumRows={2}
          />

          <StandupLinkedIssuesEditor
            projectKey={projectKey}
            issues={linkedIssues}
            lockedKeys={[issueKey]}
            onAddIssues={addLinkedIssues}
            onRemoveIssue={removeLinkedIssue}
            onReorderIssues={reorderLinkedIssues}
            onStatusChange={updateIssueStatus}
          />

          <FormFooter align="start">
            <LoadingButton
              type="submit"
              appearance="primary"
              isLoading={submitting}
              isDisabled={!canSubmit}
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
            const hasBlocker = hasRealBlocker(entry.blockers);
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
