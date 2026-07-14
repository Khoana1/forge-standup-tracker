import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  TextArea,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const TeamConfigPage = () => {
  const [enabledProjectsText, setEnabledProjectsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    invoke('getTeamConfiguration')
      .then(({ teamConfig }) => {
        setEnabledProjectsText((teamConfig?.enabledProjects ?? []).join('\n'));
      })
      .catch((e) => setError(e?.message ?? 'Could not load team configuration.'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const enabledProjects = enabledProjectsText
      .split(/[\n,]+/)
      .map((k) => k.trim().toUpperCase())
      .filter(Boolean);

    try {
      await invoke('saveTeamConfiguration', { enabledProjects });
      setSuccess(true);
    } catch (e) {
      setError(e?.message ?? 'Could not save team configuration.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spinner label="Loading…" />;

  return (
    <Stack space="space.250">
      <Heading as="h2">Cấu hình team</Heading>
      <Text color="color.text.subtle">
        Giới hạn các project được theo dõi Team Sync. Để trống để cho phép mọi project. Project admin
        có thể mở trang này từ Project settings → Apps; Jira admin mở từ Jira settings → Apps.
      </Text>
      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {success ? (
        <SectionMessage appearance="success">Team configuration saved.</SectionMessage>
      ) : null}
      <Stack space="space.100">
        <Label labelFor="enabled-projects">Enabled project keys</Label>
        <TextArea
          id="enabled-projects"
          value={enabledProjectsText}
          onChange={(e) => setEnabledProjectsText(e?.target?.value ?? e ?? '')}
          minimumRows={6}
          placeholder={'PROJ\nDEV\nTEAM'}
        />
        <Text size="small" color="color.text.subtle">
          One project key per line (or comma-separated). Keys are validated against Jira.
        </Text>
      </Stack>
      <Button appearance="primary" onClick={onSave} isDisabled={saving}>
        {saving ? 'Saving…' : 'Save configuration'}
      </Button>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <TeamConfigPage />
  </React.StrictMode>
);
