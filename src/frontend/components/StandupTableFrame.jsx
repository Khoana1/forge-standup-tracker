import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Frame } from '@forge/react';
import { events, router } from '@forge/bridge';
import { STANDUP_PLACEHOLDER, STANDUP_TABLE_HEADERS, STANDUP_LINKED_WORK_ITEMS_TITLE } from '../../lib/labels.js';

const safeOff = (off) => {
  if (typeof off === 'function') off();
};

export const StandupTableFrame = ({
  rows,
  onChange,
  onAddRow,
  onRemoveRow,
  onCellBlur,
  minRows = 1,
  maxRows = 20,
  projectKey,
  issues,
  lockedKeys,
  maxIssues = 20,
  enableReorder = false,
  enableStatusChange = false,
  onAddIssues,
  onRemoveIssue,
  onReorderIssues,
  onStatusChange,
  issuesTitle = STANDUP_LINKED_WORK_ITEMS_TITLE,
}) => {
  const [height, setHeight] = useState('280px');
  const [forceSync, setForceSync] = useState(0);
  const readyTableRef = useRef(false);
  const readyIssuesRef = useRef(false);
  const mountedRef = useRef(true);
  const rowsRef = useRef(rows);
  const issuesRef = useRef(issues ?? []);

  rowsRef.current = rows;
  issuesRef.current = issues ?? [];

  const showIssues = issues !== undefined;
  const rowStructureKey = useMemo(() => rows.map((row) => row.id).join('|'), [rows]);
  const issueSyncKey = useMemo(
    () =>
      (issues ?? [])
        .map(
          (issue) =>
            `${issue.key}|${issue.summary ?? ''}|${issue.status ?? ''}|${issue.statusCategory ?? ''}|${issue.issueType ?? ''}`
        )
        .join(','),
    [issues]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      readyTableRef.current = false;
      readyIssuesRef.current = false;
      events.emit('DAILY_TABLE_PAUSE');
    };
  }, []);

  const syncTable = () => {
    if (!mountedRef.current) return;
    events.emit('DAILY_TABLE_SYNC', {
      rows: rowsRef.current,
      placeholders: STANDUP_PLACEHOLDER,
      headers: STANDUP_TABLE_HEADERS,
      minRows,
      maxRows,
    });
  };

  const syncIssues = () => {
    if (!mountedRef.current || !showIssues) return;
    events.emit('ISSUE_HUB_SYNC', {
      projectKey,
      issues: issuesRef.current,
      lockedKeys: lockedKeys ?? [],
      maxIssues,
      enableReorder,
      enableStatusChange,
      title: issuesTitle,
    });
  };

  const syncAll = () => {
    syncTable();
    syncIssues();
  };

  useEffect(() => {
    const offTableReady = events.on('DAILY_TABLE_READY', () => {
      if (!mountedRef.current) return;
      readyTableRef.current = true;
      syncTable();
    });
    const offIssuesReady = events.on('ISSUE_HUB_READY', () => {
      if (!mountedRef.current) return;
      readyIssuesRef.current = true;
      syncIssues();
    });
    const offChange = events.on('DAILY_TABLE_CHANGE', ({ rows: nextRows }) => {
      if (!mountedRef.current || !nextRows) return;
      onChange?.(nextRows);
    });
    const offAdd = events.on('DAILY_TABLE_ADD_ROW', () => {
      if (!mountedRef.current) return;
      onAddRow?.();
    });
    const offRemove = events.on('DAILY_TABLE_REMOVE_ROW', ({ rowId }) => {
      if (!mountedRef.current || !rowId) return;
      onRemoveRow?.(rowId);
    });
    const offBlur = events.on('DAILY_TABLE_CELL_BLUR', ({ rowId, field, value }) => {
      if (!mountedRef.current) return;
      onCellBlur?.(rowId, field, value, () => {
        if (mountedRef.current) setForceSync((n) => n + 1);
      });
    });
    const offAddIssues = events.on('ISSUE_HUB_ADD', ({ items }) => {
      if (!mountedRef.current || !items?.length) return;
      onAddIssues?.(items);
    });
    const offRemoveIssue = events.on('ISSUE_HUB_REMOVE', ({ key }) => {
      if (!mountedRef.current || !key) return;
      onRemoveIssue?.(key);
    });
    const offReorder = events.on('ISSUE_HUB_REORDER', ({ keys }) => {
      if (!mountedRef.current || !keys?.length || !onReorderIssues) return;
      const byKey = new Map(issuesRef.current.map((issue) => [issue.key, issue]));
      const reordered = keys.map((key) => byKey.get(key)).filter(Boolean);
      if (reordered.length) onReorderIssues(reordered);
    });
    const offStatus = events.on('ISSUE_HUB_STATUS_CHANGE', ({ issueKey, nextStatus }) => {
      if (!mountedRef.current || !issueKey || !nextStatus) return;
      onStatusChange?.(issueKey, nextStatus);
    });
    const offOpen = events.on('ISSUE_HUB_OPEN', ({ key }) => {
      if (!mountedRef.current || !key) return;
      router.open(`/browse/${key}`);
    });
    const offResize = events.on('DAILY_TABLE_RESIZE', ({ height: nextHeight }) => {
      if (!mountedRef.current || !nextHeight) return;
      setHeight(`${nextHeight}px`);
    });

    if (readyTableRef.current || readyIssuesRef.current) syncAll();

    return () => {
      safeOff(offTableReady);
      safeOff(offIssuesReady);
      safeOff(offChange);
      safeOff(offAdd);
      safeOff(offRemove);
      safeOff(offBlur);
      safeOff(offAddIssues);
      safeOff(offRemoveIssue);
      safeOff(offReorder);
      safeOff(offStatus);
      safeOff(offOpen);
      safeOff(offResize);
    };
  }, [
    onChange,
    onAddRow,
    onRemoveRow,
    onCellBlur,
    minRows,
    maxRows,
    showIssues,
    projectKey,
    lockedKeys,
    maxIssues,
    enableReorder,
    enableStatusChange,
    onAddIssues,
    onRemoveIssue,
    onReorderIssues,
    onStatusChange,
    issuesTitle,
  ]);

  useEffect(() => {
    if (readyTableRef.current) syncTable();
  }, [rowStructureKey, forceSync, minRows, maxRows]);

  useEffect(() => {
    if (readyIssuesRef.current) syncIssues();
  }, [
    issueSyncKey,
    projectKey,
    lockedKeys,
    maxIssues,
    enableReorder,
    enableStatusChange,
    issuesTitle,
    showIssues,
  ]);

  return (
    <Box xcss={{ width: '100%', borderRadius: 'radius.large', overflow: 'hidden' }}>
      <Frame resource="daily-report-table-ui" height={height} />
    </Box>
  );
};
