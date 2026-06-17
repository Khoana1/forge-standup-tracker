import React, { useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  SectionMessage,
  Stack,
  Text,
  Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const DataPrivacyPage = () => {
  const [exportData, setExportData] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [purgeResult, setPurgeResult] = useState(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke('exportStandupData');
      setExportData(data);
    } catch (e) {
      setError(e?.message ?? 'Export failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    setLoading(true);
    setError(null);
    setPurgeResult(null);
    try {
      const result = await invoke('purgeStandupData', { confirm });
      setPurgeResult(result);
      setExportData(null);
      setConfirm('');
    } catch (e) {
      setError(e?.message ?? 'Purge failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="space.300">
      <Heading as="h2">Data &amp; privacy</Heading>
      <Text color="color.text.subtle">
        Export or delete all standup data stored by this app. Only Jira administrators can access
        this page.
      </Text>

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {purgeResult ? (
        <SectionMessage appearance="success">
          Purged {purgeResult.deleted} standup entries.
        </SectionMessage>
      ) : null}

      <Stack space="space.150">
        <Heading as="h3">Export data</Heading>
        <Text size="small" color="color.text.subtle">
          Download a JSON snapshot of settings and standup entries for compliance or backup.
        </Text>
        <Button appearance="primary" onClick={handleExport} isDisabled={loading}>
          Export all data
        </Button>
        {exportData ? (
          <SectionMessage appearance="information" title="Export ready">
            <Text>
              {exportData.entryCount} entries exported at {exportData.exportedAt}. Copy the JSON
              below for your records.
            </Text>
          </SectionMessage>
        ) : null}
        {exportData ? (
          <Text>{JSON.stringify(exportData, null, 2).slice(0, 4000)}…</Text>
        ) : null}
      </Stack>

      <Stack space="space.150">
        <Heading as="h3">Delete all data</Heading>
        <SectionMessage appearance="warning" title="Irreversible">
          <Text>
            This permanently deletes every standup entry. Type{' '}
            <Text weight="bold">DELETE_ALL_STANDUP_DATA</Text> to confirm.
          </Text>
        </SectionMessage>
        <Textfield
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE_ALL_STANDUP_DATA"
        />
        <Button
          appearance="danger"
          onClick={handlePurge}
          isDisabled={loading || confirm !== 'DELETE_ALL_STANDUP_DATA'}
        >
          Purge all standup data
        </Button>
      </Stack>

      <Stack space="space.100">
        <Heading as="h3">Privacy notice</Heading>
        <Text size="small">
          Standup entries are stored in Forge app storage, isolated per Jira site (tenant). Data
          includes account IDs, display names, and standup text. No data is sent to third parties.
          Retention is controlled in General Settings.
        </Text>
      </Stack>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <DataPrivacyPage />
  </React.StrictMode>
);
