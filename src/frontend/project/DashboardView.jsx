import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Form,
  Heading,
  Inline,
  Label,
  LoadingButton,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  TextArea,
  useForm,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { isoToDayMonth } from '../../lib/dates.js';
import { formatTeamSyncTitle, UI_COPY } from '../../lib/labels.js';
import {
  DashboardUpdateCard,
  EmptyPrompt,
  MemberSelectCard,
  PageHeader,
} from '../components/ui.jsx';

const ResolveBlockerModal = ({ entry, projectKey, date, onClose, onSaved }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const { handleSubmit, register, getFieldId, getValues } = useForm({
    resolutionPlan: '',
  });

  const onSubmit = handleSubmit(async () => {
    const resolutionPlan = getValues().resolutionPlan?.trim() ?? '';
    if (resolutionPlan.length < 3) {
      setSubmitError('Phương án giải quyết phải có ít nhất 3 ký tự.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await invoke('resolveBlocker', {
        projectKey,
        date,
        accountId: entry.accountId,
        resolutionPlan,
      });
      onSaved();
    } catch (e) {
      setSubmitError(e?.message ?? 'Không lưu được phương án giải quyết.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Modal onClose={onClose} width="medium">
      <ModalHeader>
        <ModalTitle>Phương án giải quyết vấn đề</ModalTitle>
      </ModalHeader>
      <Form onSubmit={onSubmit}>
        <ModalBody>
          <Stack space="space.200">
            <Stack space="space.050">
              <Text size="small" color="color.text.subtle">
                Thành viên
              </Text>
              <Text weight="semibold">{entry.displayName}</Text>
            </Stack>
            <Stack space="space.050">
              <Text size="small" color="color.text.subtle">
                Vấn đề
              </Text>
              <Text color="color.text.danger">{entry.blockers}</Text>
            </Stack>
            <Stack space="space.050">
              <Label labelFor={getFieldId('resolutionPlan')}>Phương án giải quyết</Label>
              <TextArea
                {...register('resolutionPlan', { isRequired: true })}
                id={getFieldId('resolutionPlan')}
                minimumRows={4}
                placeholder="Mô tả cách team xử lý khó khăn này (ví dụ: đã cấp quyền, chuyển ticket, thay giải pháp tạm…)"
              />
            </Stack>
            {submitError ? <SectionMessage appearance="error">{submitError}</SectionMessage> : null}
          </Stack>
        </ModalBody>
        <ModalFooter>
          <Button appearance="subtle" onClick={onClose} isDisabled={submitting}>
            Hủy
          </Button>
          <LoadingButton appearance="primary" type="submit" isLoading={submitting}>
            Lưu và đánh dấu đã xử lý
          </LoadingButton>
        </ModalFooter>
      </Form>
    </Modal>
  );
};

export const DashboardView = ({ projectKey, onLogStandup }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [memberFilter, setMemberFilter] = useState('');
  const [resolveTarget, setResolveTarget] = useState(null);
  const [exportMsg, setExportMsg] = useState(null);
  const canAdminister = data?.permissions?.canAdministerProject ?? false;
  const canExport = data?.permissions?.isJiraAdmin ?? false;

  const load = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getProjectDashboard', {
        projectKey,
        memberAccountId: memberFilter || null,
      });
      setData(result);
    } catch (e) {
      setError(e?.message ?? 'Không tải được tổng quan team.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, memberFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMemberSelect = (accountId) => {
    setMemberFilter((prev) => (prev === accountId ? '' : accountId));
  };

  const handleResolveSaved = async () => {
    setResolveTarget(null);
    await load();
  };

  const handleExport = async () => {
    if (!canExport) {
      setError('Chỉ Jira admin mới được xuất toàn bộ dữ liệu.');
      return;
    }
    try {
      const payload = await invoke('exportStandupData');
      setExportMsg(`Đã chuẩn bị xuất ${payload.entryCount} bản ghi.`);
    } catch (e) {
      setError(e?.message ?? 'Không xuất được dữ liệu.');
    }
  };

  if (loading && !data) return <Spinner label="Đang tải tổng quan team…" />;
  if (error && !data) return <SectionMessage appearance="error">{error}</SectionMessage>;
  if (!data) return <SectionMessage appearance="warning">Không có dữ liệu tổng quan.</SectionMessage>;

  const todayLabel = isoToDayMonth(data?.today);
  const timeline = data?.timeline ?? [];
  const members = data?.members ?? [];
  const pageTitle = formatTeamSyncTitle(data?.activeSprint?.name);
  const teamLabel = data?.projectKey ?? projectKey;

  return (
    <Stack space="space.300">
      <PageHeader
        title={pageTitle}
        subtitle={`Team ${teamLabel} · ${UI_COPY.teamSyncSubtitle}`}
        actions={
          <>
            {canExport ? (
              <Button appearance="default" onClick={handleExport}>
                Xuất dữ liệu
              </Button>
            ) : null}
            <Button appearance="primary" onClick={onLogStandup}>
              Ghi Team Sync của tôi
            </Button>
          </>
        }
      />

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {exportMsg ? <SectionMessage appearance="success">{exportMsg}</SectionMessage> : null}

      {members.length ? (
        <Stack space="space.150">
          <Heading as="h3">Thành viên team</Heading>
          <Inline space="space.150" alignBlock="stretch" shouldWrap>
            {members.map((m) => (
              <Box key={m.accountId} grow="fill">
                <MemberSelectCard
                  accountId={m.accountId}
                  name={m.displayName}
                  loggedToday={m.loggedToday}
                  selected={memberFilter === m.accountId}
                  onSelect={() => handleMemberSelect(m.accountId)}
                />
              </Box>
            ))}
          </Inline>
        </Stack>
      ) : null}

      <Stack space="space.200">
        <Inline space="space.050" alignBlock="center">
          <Heading as="h3">Team Sync hôm nay</Heading>
          {todayLabel ? (
            <Text color="color.text.subtle">· {todayLabel}</Text>
          ) : null}
        </Inline>

        {timeline.length === 0 ? (
          <EmptyPrompt
            header="Chưa có ai ghi Team Sync hôm nay"
            description="Bắt đầu buổi sync bằng cách ghi Tasks, Progress và Problems — mất khoảng 2 phút."
            actionLabel="Ghi Team Sync của tôi"
            onAction={onLogStandup}
          />
        ) : (
          <Stack space="space.200">
            {timeline.map((entry) => (
              <DashboardUpdateCard
                key={entry.accountId}
                entry={entry}
                canAdminister={canAdminister}
                onOpenResolveModal={setResolveTarget}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {resolveTarget ? (
        <ResolveBlockerModal
          entry={resolveTarget}
          projectKey={projectKey}
          date={data?.today}
          onClose={() => setResolveTarget(null)}
          onSaved={handleResolveSaved}
        />
      ) : null}

      {loading ? <Spinner label="Đang làm mới…" /> : null}
    </Stack>
  );
};

export default DashboardView;
