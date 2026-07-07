import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Form,
  FormFooter,
  Heading,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  Toggle,
  useForm,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const APP_SCOPES = ['storage:app', 'read:jira-user', 'read:jira-work', 'write:jira-work'];

const SettingsPage = () => {
  const { handleSubmit, register, getFieldId, setValue, watch } = useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const enabled = watch('enabled');

  useEffect(() => {
    invoke('getSettings')
      .then(({ settings }) => {
        setValue('enabled', settings.enabled);
        setValue('retentionDays', String(settings.retentionDays));
        setValue('timezone', settings.timezone);
        setValue('standupWindowTime', settings.standupWindowTime ?? '09:00');
        setValue('skipWeekends', settings.skipWeekends ?? true);
        setValue('weeklySummaryAuto', settings.weeklySummaryAuto ?? false);
        setValue('blockerAlertDays', String(settings.blockerAlertDays ?? 1));
        setValue('notifyProjectAdminsOnProblem', settings.notifyProjectAdminsOnProblem ?? true);
      })
      .catch((e) => setError(e?.message ?? 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, [setValue]);

  const onSubmit = async (data) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await invoke('saveSettings', {
        enabled: Boolean(data.enabled),
        retentionDays: Number(data.retentionDays),
        timezone: data.timezone,
        standupWindowTime: data.standupWindowTime,
        skipWeekends: Boolean(data.skipWeekends),
        weeklySummaryAuto: Boolean(data.weeklySummaryAuto),
        blockerAlertDays: Number(data.blockerAlertDays),
        notifyProjectAdminsOnProblem: Boolean(data.notifyProjectAdminsOnProblem),
      });
      setSuccess(true);
    } catch (e) {
      setError(e?.message ?? 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading settings…" />;

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Stack space="space.300">
        <Heading as="h2">General settings</Heading>
        {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
        {success ? <SectionMessage appearance="success">Settings saved.</SectionMessage> : null}

        <Stack space="space.200">
          <Heading as="h3">Trạng thái app</Heading>
          <Stack space="space.100">
            <Label labelFor={getFieldId('enabled')}>Enable Team Sync tracking</Label>
            <Toggle {...register('enabled')} id={getFieldId('enabled')} isChecked={enabled} />
          </Stack>
          <Stack space="space.100">
            <Label labelFor={getFieldId('retentionDays')}>Data retention (days)</Label>
            <Textfield
              {...register('retentionDays', { required: true })}
              type="number"
              min={7}
              max={365}
            />
          </Stack>
        </Stack>

        <Stack space="space.200">
          <Heading as="h3">Lịch Team Sync</Heading>
          <Stack space="space.100">
            <Label labelFor={getFieldId('standupWindowTime')}>Khung giờ Team Sync (HH:MM)</Label>
            <Textfield {...register('standupWindowTime', { required: true })} placeholder="09:00" />
          </Stack>
          <Stack space="space.100">
            <Label labelFor={getFieldId('timezone')}>Timezone</Label>
            <Textfield {...register('timezone', { required: true })} placeholder="Asia/Ho_Chi_Minh" />
          </Stack>
          <Stack space="space.100">
            <Label labelFor={getFieldId('skipWeekends')}>Bỏ qua cuối tuần</Label>
            <Toggle {...register('skipWeekends')} id={getFieldId('skipWeekends')} />
          </Stack>
          <Stack space="space.100">
            <Label labelFor={getFieldId('weeklySummaryAuto')}>Tự tạo tổng kết sprint (2 tuần)</Label>
            <Toggle {...register('weeklySummaryAuto')} id={getFieldId('weeklySummaryAuto')} />
          </Stack>
        </Stack>

        <Stack space="space.200">
          <Heading as="h3">Problems</Heading>
          <Stack space="space.100">
            <Label labelFor={getFieldId('blockerAlertDays')}>Cảnh báo khó khăn chưa xử lý (ngày)</Label>
            <Textfield {...register('blockerAlertDays')} type="number" min={0} max={14} />
          </Stack>
          <Stack space="space.100">
            <Label labelFor={getFieldId('notifyProjectAdminsOnProblem')}>
              Gửi email cho quản trị project khi có Problems
            </Label>
            <Toggle
              {...register('notifyProjectAdminsOnProblem')}
              id={getFieldId('notifyProjectAdminsOnProblem')}
            />
            <Text color="color.text.subtle" size="small">
              Email gửi tới các user trong role Administrators của project (qua Jira notification).
              Chỉ gửi khi có vấn đề mới hoặc nội dung Problems thay đổi.
            </Text>
          </Stack>
        </Stack>

        <Stack space="space.200">
          <Heading as="h3">App scopes</Heading>
          <Text color="color.text.subtle" size="small">
            Quyền truy cập Jira được kiểm tra theo user đang đăng nhập (api.asUser), không phải quyền
            mặc định của app.
          </Text>
          <Stack space="space.050">
            {APP_SCOPES.map((scope) => (
              <Text key={scope} size="small">
                {scope}
              </Text>
            ))}
          </Stack>
        </Stack>

        <FormFooter align="start">
          <Button type="submit" appearance="primary" isDisabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </FormFooter>
      </Stack>
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
