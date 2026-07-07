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
  TextArea,
  useForm,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const TeamConfigPage = () => {
  const { handleSubmit, register, getFieldId, setValue } = useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    invoke('getTeamConfiguration')
      .then(({ teamConfig }) => {
        const keys = (teamConfig?.enabledProjects ?? []).join('\n');
        setValue('enabledProjects', keys);
      })
      .catch((e) => setError(e?.message ?? 'Could not load team configuration.'))
      .finally(() => setLoading(false));
  }, [setValue]);

  const onSubmit = async (data) => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const enabledProjects = (data.enabledProjects ?? '')
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
    <Form onSubmit={handleSubmit(onSubmit)}>
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
          <Label labelFor={getFieldId('enabledProjects')}>Enabled project keys</Label>
          <TextArea
            {...register('enabledProjects')}
            minimumRows={6}
            placeholder={'PROJ\nDEV\nTEAM'}
          />
          <Text size="small" color="color.text.subtle">
            One project key per line (or comma-separated). Keys are validated against Jira.
          </Text>
        </Stack>
        <FormFooter align="start">
          <Button type="submit" appearance="primary" isDisabled={saving}>
            {saving ? 'Saving…' : 'Save configuration'}
          </Button>
        </FormFooter>
      </Stack>
    </Form>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <TeamConfigPage />
  </React.StrictMode>
);
