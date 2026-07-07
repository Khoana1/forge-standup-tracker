import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Frame } from '@forge/react';
import { events, router } from '@forge/bridge';
import { STANDUP_LINKED_WORK_ITEMS_TITLE } from '../../lib/labels.js';

export const IssueHubFrame = ({
  projectKey,
  issues = [],
  lockedKeys = [],
  maxIssues = 20,
  enableReorder = false,
  enableStatusChange = false,
  onAddIssues,
  onRemoveIssue,
  onReorderIssues,
  onStatusChange,
  issuesTitle = STANDUP_LINKED_WORK_ITEMS_TITLE,
}) => {
  const [height, setHeight] = useState('240px');
  const readyRef = useRef(false);
  const issuesRef = useRef(issues);

  issuesRef.current = issues;

  const issueSyncKey = useMemo(
    () =>
      issues
        .map(
          (issue) =>
            `${issue.key}|${issue.summary ?? ''}|${issue.status ?? ''}|${issue.statusCategory ?? ''}|${issue.issueType ?? ''}`
        )
        .join(','),
    [issues]
  );

  const sync = () => {
    events.emit('ISSUE_HUB_SYNC', {
      projectKey,
      issues: issuesRef.current,
      lockedKeys,
      maxIssues,
      enableReorder,
      enableStatusChange,
      title: issuesTitle,
    });
  };

  useEffect(() => {
    const offReady = events.on('ISSUE_HUB_READY', () => {
      readyRef.current = true;
      sync();
    });
    const offAdd = events.on('ISSUE_HUB_ADD', ({ items }) => {
      if (items?.length) onAddIssues?.(items);
    });
    const offRemove = events.on('ISSUE_HUB_REMOVE', ({ key }) => {
      if (key) onRemoveIssue?.(key);
    });
    const offReorder = events.on('ISSUE_HUB_REORDER', ({ keys }) => {
      if (!keys?.length || !onReorderIssues) return;
      const byKey = new Map(issuesRef.current.map((issue) => [issue.key, issue]));
      const reordered = keys.map((key) => byKey.get(key)).filter(Boolean);
      if (reordered.length) onReorderIssues(reordered);
    });
    const offStatus = events.on('ISSUE_HUB_STATUS_CHANGE', ({ issueKey, nextStatus }) => {
      if (issueKey && nextStatus) onStatusChange?.(issueKey, nextStatus);
    });
    const offOpen = events.on('ISSUE_HUB_OPEN', ({ key }) => {
      if (key) router.open(`/browse/${key}`);
    });
    const offResize = events.on('ISSUE_HUB_RESIZE', ({ height: nextHeight }) => {
      if (nextHeight) setHeight(`${nextHeight}px`);
    });

    if (readyRef.current) sync();

    return () => {
      offReady();
      offAdd();
      offRemove();
      offReorder();
      offStatus();
      offOpen();
      offResize();
    };
  }, [
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
    if (readyRef.current) sync();
  }, [issueSyncKey, projectKey, lockedKeys, maxIssues, enableReorder, enableStatusChange, issuesTitle]);

  return (
    <Box
      xcss={{
        borderRadius: 'radius.medium',
        overflow: 'visible',
      }}
    >
      <Frame resource="issue-hub-ui" height={height} />
    </Box>
  );
};
