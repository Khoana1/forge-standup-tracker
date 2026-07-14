import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  Toggle,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const APP_SCOPES = [
  'storage:app',
  'read:jira-user',
  'read:jira-work',
  'write:jira-work',
  'read:project:jira',
  'manage:jira-project',
  'read:board-scope:jira-software',
  'read:sprint:jira-software',
];

const DEFAULT_FORM = {
  enabled: true,
  retentionDays: '90',
  timezone: 'UTC',
  standupWindowTime: '09:00',
  skipWeekends: true,
  weeklySummaryAuto: false,
  blockerAlertDays: '1',
  notifyProjectAdminsOnProblem: true,
};

const fieldValue = (e) => e?.target?.value ?? e ?? '';

const SettingsPage = () => {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    invoke('getSettings')
      .then(({ settings }) => {
        setForm({
          enabled: Boolean(settings.enabled),
          retentionDays: String(settings.retentionDays ?? 90),
          timezone: settings.timezone ?? 'UTC',
          standupWindowTime: settings.standupWindowTime ?? '09:00',
          skipWeekends: Boolean(settings.skipWeekends ?? true),
          weeklySummaryAuto: Boolean(settings.weeklySummaryAuto ?? false),
          blockerAlertDays: String(settings.blockerAlertDays ?? 1),
          notifyProjectAdminsOnProblem: Boolean(settings.notifyProjectAdminsOnProblem ?? true),
        });
      })
      .catch((e) => setError(e?.message ?? 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await invoke('saveSettings', {
        enabled: Boolean(form.enabled),
        retentionDays: Number(form.retentionDays),
        timezone: form.timezone,
        standupWindowTime: form.standupWindowTime,
        skipWeekends: Boolean(form.skipWeekends),
        weeklySummaryAuto: Boolean(form.weeklySummaryAuto),
        blockerAlertDays: Number(form.blockerAlertDays),
        notifyProjectAdminsOnProblem: Boolean(form.notifyProjectAdminsOnProblem),
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
    <Stack space="space.300">
      <Heading as="h2">General settings</Heading>
      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {success ? <SectionMessage appearance="success">Settings saved.</SectionMessage> : null}

      <Stack space="space.200">
        <Heading as="h3">Trạng thái app</Heading>
        <Stack space="space.100">
          <Label labelFor="enabled">Enable Team Sync tracking</Label>
          <Toggle
            id="enabled"
            isChecked={form.enabled}
            onChange={() => setField('enabled', !form.enabled)}
          />
        </Stack>
        <Stack space="space.100">
          <Label labelFor="retentionDays">Data retention (days)</Label>
          <Textfield
            id="retentionDays"
            type="number"
            min={7}
            max={365}
            value={form.retentionDays}
            onChange={(e) => setField('retentionDays', fieldValue(e))}
          />
        </Stack>
      </Stack>

      <Stack space="space.200">
        <Heading as="h3">Lịch Team Sync</Heading>
        <Stack space="space.100">
          <Label labelFor="standupWindowTime">Khung giờ Team Sync (HH:MM)</Label>
          <Textfield
            id="standupWindowTime"
            placeholder="09:00"
            value={form.standupWindowTime}
            onChange={(e) => setField('standupWindowTime', fieldValue(e))}
          />
        </Stack>
        <Stack space="space.100">
          <Label labelFor="timezone">Timezone</Label>
          <Textfield
            id="timezone"
            placeholder="Asia/Ho_Chi_Minh"
            value={form.timezone}
            onChange={(e) => setField('timezone', fieldValue(e))}
          />
        </Stack>
        <Stack space="space.100">
          <Label labelFor="skipWeekends">Bỏ qua cuối tuần</Label>
          <Toggle
            id="skipWeekends"
            isChecked={form.skipWeekends}
            onChange={() => setField('skipWeekends', !form.skipWeekends)}
          />
        </Stack>
        <Stack space="space.100">
          <Label labelFor="weeklySummaryAuto">Tự tạo tổng kết sprint (2 tuần)</Label>
          <Toggle
            id="weeklySummaryAuto"
            isChecked={form.weeklySummaryAuto}
            onChange={() => setField('weeklySummaryAuto', !form.weeklySummaryAuto)}
          />
        </Stack>
      </Stack>

      <Stack space="space.200">
        <Heading as="h3">Problems</Heading>
        <Stack space="space.100">
          <Label labelFor="blockerAlertDays">Cảnh báo khó khăn chưa xử lý (ngày)</Label>
          <Textfield
            id="blockerAlertDays"
            type="number"
            min={0}
            max={14}
            value={form.blockerAlertDays}
            onChange={(e) => setField('blockerAlertDays', fieldValue(e))}
          />
        </Stack>
        <Stack space="space.100">
          <Label labelFor="notifyProjectAdminsOnProblem">
            Gửi email cho quản trị project khi có Problems
          </Label>
          <Toggle
            id="notifyProjectAdminsOnProblem"
            isChecked={form.notifyProjectAdminsOnProblem}
            onChange={() =>
              setField('notifyProjectAdminsOnProblem', !form.notifyProjectAdminsOnProblem)
            }
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

      <Button appearance="primary" onClick={onSave} isDisabled={saving}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <SettingsPage />
  </React.StrictMode>
);
