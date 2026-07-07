import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  DatePicker,
  Form,
  FormFooter,
  Heading,
  Inline,
  Label,
  LoadingButton,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  useForm,
  useProductContext,
} from '@forge/react';
import { invoke, view, events } from '@forge/bridge';
import DashboardView from './DashboardView.jsx';
import { StandupTableFrame } from '../components/StandupTableFrame.jsx';
import {
  EmptyPrompt,
  HistoryEntryCard,
  PageHeader,
  SurfaceCard,
} from '../components/ui.jsx';
import {
  extractPlainText,
  serializeStandupText,
} from '../../lib/adf-helpers.js';
import { useStandupForm } from '../hooks/useStandupForm.js';
import {
  DISPLAY_DATE_FORMAT,
  addDaysIso,
  isoToDisplay,
  mondayOfWeekIso,
  todayIso,
} from '../../lib/dates.js';
import {
  STANDUP_PLACEHOLDER,
  STANDUP_TABLE_HEADERS,
  UI_COPY,
  formatTeamSyncTitle,
} from '../../lib/labels.js';
import {
  createDefaultRows,
  createRowId,
  fieldsToRows,
  rowsToFields,
} from '../../lib/standup-rows.js';
import { isStandupFieldEmpty } from '../../lib/adf-helpers.js';

const VIEW_DASHBOARD = 'dashboard';
const VIEW_LOG = 'log';
const VIEW_HISTORY = 'history';
const VIEW_SUMMARY = 'summary';

const routeFromPathname = (pathname = '') => {
  const last = pathname.split('/').filter(Boolean).pop()?.toLowerCase() ?? '';
  if (last === VIEW_DASHBOARD) return VIEW_DASHBOARD;
  if (last === VIEW_HISTORY) return VIEW_HISTORY;
  if (last === VIEW_SUMMARY) return VIEW_SUMMARY;
  if (last === VIEW_LOG) return VIEW_LOG;
  return VIEW_DASHBOARD;
};

const hasRealBlocker = (text) => {
  const lower = extractPlainText(text).toLowerCase();
  return lower.length > 0 && !['none', 'không có', 'khong co', 'n/a'].includes(lower);
};

const StandupDatePicker = ({ id, label, value, onChange }) => (
  <Stack space="space.050">
    <Label labelFor={id}>{label}</Label>
    <DatePicker
      id={id}
      shouldShowCalendarButton
      value={value}
      onChange={(iso) => {
        if (iso) onChange(iso);
      }}
      dateFormat={DISPLAY_DATE_FORMAT}
      locale="vi-VN"
      placeholder="dd/mm/yyyy"
      weekStartDay={1}
    />
  </Stack>
);

const LogStandupForm = ({ projectKey, sprintName, onSubmitted }) => {
  const { handleSubmit, setValue } = useForm({
    defaultValues: {
      yesterday: '',
      today: '',
      blockers: STANDUP_PLACEHOLDER.problems,
    },
  });
  const [rows, setRows] = useState(() => createDefaultRows());
  const {
    absorbCellPaste,
    addLinkedIssues,
    linkedIssueKeys,
    linkedIssues,
    loadEntry,
    removeLinkedIssue,
    reorderLinkedIssues,
    updateIssueStatus,
  } = useStandupForm({
    register: () => ({}),
    setValue,
    defaultBlockers: STANDUP_PLACEHOLDER.problems,
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [alreadyLogged, setAlreadyLogged] = useState(false);

  const canSubmit = useMemo(() => {
    const fields = rowsToFields(rows, STANDUP_PLACEHOLDER.problems);
    return ['yesterday', 'today', 'blockers'].every(
      (name) => !isStandupFieldEmpty(fields[name], [])
    );
  }, [rows]);

  const handleAddRow = useCallback(() => {
    setRows((prev) => [
      ...prev,
      { id: createRowId(), tasks: '', progress: '', problems: '' },
    ]);
  }, []);

  const handleRemoveRow = useCallback((rowId) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== rowId)));
  }, []);

  const handleCellBlur = useCallback(
    (rowId, field, value, done) => {
      const result = absorbCellPaste(value, (stripped) => {
        setRows((prev) =>
          prev.map((row) => (row.id === rowId ? { ...row, [field]: stripped } : row))
        );
        done?.();
      });
      if (result === value) done?.();
    },
    [absorbCellPaste]
  );

  useEffect(() => {
    if (!projectKey) return;
    invoke('getMyStandupToday', { projectKey, date: todayIso() })
      .then(async ({ entry }) => {
        if (entry) {
          setAlreadyLogged(true);
          await loadEntry(entry);
          setRows(
            fieldsToRows(
              {
                yesterday: extractPlainText(entry.yesterday),
                today: extractPlainText(entry.today),
                blockers: extractPlainText(entry.blockers),
              },
              { defaultRowCount: createDefaultRows().length }
            )
          );
          setMessage('Bạn đã ghi Team Sync hôm nay. Gửi lại nếu muốn cập nhật nội dung.');
        }
      })
      .catch(() => {});
  }, [projectKey, loadEntry]);

  const onSubmit = handleSubmit(async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const data = rowsToFields(rows, STANDUP_PLACEHOLDER.problems);
    try {
      const result = await invoke('submitStandup', {
        projectKey,
        yesterday: serializeStandupText(data.yesterday),
        today: serializeStandupText(data.today),
        blockers: serializeStandupText(data.blockers),
        linkedIssueKeys,
        date: todayIso(),
      });
      setAlreadyLogged(true);
      if (result?.problemNotification?.sent > 0) {
        setMessage('Đã lưu Team Sync. Đã gửi email thông báo cho quản trị project.');
      } else {
        setMessage('Đã lưu Team Sync. Cảm ơn bạn!');
      }
      onSubmitted?.();
    } catch (e) {
      setError(e?.message ?? 'Không lưu được Team Sync.');
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Stack space="space.250">
      <PageHeader
        title={formatTeamSyncTitle(sprintName)}
        subtitle={UI_COPY.teamSyncSubtitle}
      />

      {alreadyLogged ? (
        <SectionMessage appearance="success" title="Đã ghi hôm nay">
          <Text>Bạn có thể chỉnh sửa và gửi lại bất cứ lúc nào trong ngày.</Text>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="information" title="Bắt đầu nhanh">
          <Text>
            Điền bảng Tasks / Progress / Problems — mỗi hàng là một mục công việc. Mặc định 3 hàng;
            thêm hoặc xóa hàng khi cần. Work item Jira gom ở mục «Work item làm việc hôm nay».
          </Text>
        </SectionMessage>
      )}

      <Form onSubmit={onSubmit}>
        <Stack space="space.200">
          {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
          {message ? <SectionMessage appearance="information">{message}</SectionMessage> : null}

          <StandupTableFrame
            rows={rows}
            onChange={setRows}
            onAddRow={handleAddRow}
            onRemoveRow={handleRemoveRow}
            onCellBlur={handleCellBlur}
            projectKey={projectKey}
            issues={linkedIssues}
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
              {alreadyLogged ? 'Cập nhật Team Sync' : 'Gửi Team Sync hôm nay'}
            </LoadingButton>
          </FormFooter>
        </Stack>
      </Form>
    </Stack>
  );
};

const TeamHistoryView = ({ projectKey, sprintName }) => {
  const [fromDate, setFromDate] = useState(() => addDaysIso(todayIso(), -14));
  const [toDate, setToDate] = useState(() => todayIso());
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getTeamHistory', { projectKey, fromDate, toDate });
      setEntries(result?.entries ?? []);
    } catch (e) {
      setError(e?.message ?? 'Không tải được lịch sử.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const entry of entries) {
      if (!map.has(entry.date)) map.set(entry.date, []);
      map.get(entry.date).push(entry);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  return (
    <Stack space="space.250">
      <PageHeader
        title={`Lịch sử · ${formatTeamSyncTitle(sprintName)}`}
        subtitle="Xem lại các bản ghi Team Sync theo khoảng ngày — khớp cột Tasks / Progress / Problems."
      />

      <SurfaceCard>
        <Stack space="space.150">
          <Inline space="space.200" alignBlock="end">
            <StandupDatePicker
              id="from-date"
              label="Từ ngày"
              value={fromDate}
              onChange={setFromDate}
            />
            <StandupDatePicker id="to-date" label="Đến ngày" value={toDate} onChange={setToDate} />
            <Button appearance="primary" onClick={load} isDisabled={loading}>
              {loading ? 'Đang tải…' : 'Áp dụng'}
            </Button>
          </Inline>
        </Stack>
      </SurfaceCard>

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {loading ? (
        <Spinner label="Đang tải lịch sử…" />
      ) : entries.length === 0 ? (
        <EmptyPrompt
          header="Chưa có bản ghi"
          description="Thử chọn khoảng ngày rộng hơn, hoặc mời team ghi Team Sync ở tab «Team Sync hôm nay»."
        />
      ) : (
        <Stack space="space.250">
          {groupedByDate.map(([date, dayEntries]) => (
            <Stack key={date} space="space.100">
              <Heading as="h3">{isoToDisplay(date)}</Heading>
              <Stack space="space.100">
                {dayEntries.map((entry) => (
                  <HistoryEntryCard
                    key={`${entry.date}-${entry.accountId}`}
                    entry={{
                      ...entry,
                      dateDisplay: isoToDisplay(entry.date),
                      hasBlocker: hasRealBlocker(entry.blockers),
                    }}
                    labels={STANDUP_TABLE_HEADERS}
                  />
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
};

const SprintSummaryView = ({ projectKey, sprintName, activeSprintStart }) => {
  const [sprintStart, setSprintStart] = useState(() => activeSprintStart ?? mondayOfWeekIso());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generate = useCallback(async () => {
    if (!projectKey) return;
    setLoading(true);
    setError(null);
    try {
      const result = await invoke('getWeeklySummary', {
        projectKey,
        sprintStartDate: sprintStart,
      });
      setSummary(result);
    } catch (e) {
      setError(e?.message ?? 'Không tạo được tổng kết sprint.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, sprintStart]);

  const handleSprintStartChange = (iso) => {
    setSprintStart(iso);
    setSummary(null);
    setError(null);
  };

  return (
    <Stack space="space.250">
      <PageHeader
        title={`Tổng kết sprint · ${formatTeamSyncTitle(sprintName)}`}
        subtitle="Tổng hợp Team Sync trong 2 tuần. Chọn ngày bắt đầu sprint, rồi bấm «Xem tổng kết»."
      />

      <SurfaceCard>
        <Stack space="space.150">
          <StandupDatePicker
            id="sprint-start"
            label="Ngày bắt đầu sprint"
            value={sprintStart}
            onChange={handleSprintStartChange}
          />
          <LoadingButton appearance="primary" onClick={generate} isLoading={loading}>
            Xem tổng kết
          </LoadingButton>
        </Stack>
      </SurfaceCard>

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}

      {!summary && !loading ? (
        <EmptyPrompt
          header="Chưa có tổng kết"
          description="Chọn ngày bắt đầu sprint (2 tuần) và bấm «Xem tổng kết». Dữ liệu lấy từ các bản ghi Team Sync đã gửi."
          actionLabel="Xem tổng kết"
          onAction={generate}
        />
      ) : null}

      {loading ? <Spinner label="Đang tạo tổng kết…" /> : null}

      {summary ? (
        <Stack space="space.200">
          <SectionMessage appearance="information">
            <Text>
              Sprint {isoToDisplay(summary.sprintStartDate ?? summary.weekStartDate)} –{' '}
              {isoToDisplay(summary.sprintEndDate ?? summary.sprintStartDate)} · 2 tuần ·{' '}
              {summary.totalEntries} bản ghi · {summary.blockerCount} có vấn đề
            </Text>
          </SectionMessage>
          {(summary.days ?? []).map((day) => (
            <Stack key={day.date} space="space.100">
              <Heading as="h3">{isoToDisplay(day.date)}</Heading>
              {day.entries.length === 0 ? (
                <Text color="color.text.subtle">Chưa có bản ghi Team Sync.</Text>
              ) : (
                day.entries.map((entry) => (
                  <HistoryEntryCard
                    key={`${day.date}-${entry.accountId}`}
                    entry={{
                      ...entry,
                      dateDisplay: isoToDisplay(day.date),
                      hasBlocker: hasRealBlocker(entry.blockers),
                      linkedIssueKeys: [],
                    }}
                    labels={STANDUP_TABLE_HEADERS}
                  />
                ))
              )}
            </Stack>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
};

const App = () => {
  const context = useProductContext();
  const projectKey = context?.extension?.project?.key;

  const [activeRoute, setActiveRoute] = useState(null);
  const [routeError, setRouteError] = useState(null);
  const [appDisabled, setAppDisabled] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [historyRef, setHistoryRef] = useState(null);
  const [sprintName, setSprintName] = useState(null);
  const [activeSprintStart, setActiveSprintStart] = useState(null);
  const [logViewMounted, setLogViewMounted] = useState(false);

  useEffect(() => {
    if (activeRoute === VIEW_LOG) {
      setLogViewMounted(true);
    }
  }, [activeRoute]);

  useEffect(() => {
    if (activeRoute !== VIEW_LOG && logViewMounted) {
      events.emit('DAILY_TABLE_PAUSE');
    }
  }, [activeRoute, logViewMounted]);

  useEffect(() => {
    let unlisten;
    (async () => {
      try {
        const history = await view.createHistory();
        setHistoryRef(history);
        setActiveRoute(routeFromPathname(history.location.pathname));
        unlisten = history.listen((loc) => {
          setActiveRoute(routeFromPathname(loc.pathname));
        });
      } catch (e) {
        setRouteError(e?.message ?? 'Không khởi tạo được điều hướng trang.');
        setActiveRoute(VIEW_DASHBOARD);
      }
    })();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const goToLog = useCallback(async () => {
    if (historyRef) {
      historyRef.push('/log');
    } else {
      setActiveRoute(VIEW_LOG);
    }
  }, [historyRef]);

  useEffect(() => {
    if (!projectKey) {
      setStatusLoading(false);
      return;
    }
    invoke('getAppStatus', { projectKey })
      .then(({ projectEnabled, activeSprint }) => {
        setAppDisabled(!projectEnabled);
        setSprintName(activeSprint?.name ?? null);
        setActiveSprintStart(activeSprint?.startDate?.slice(0, 10) ?? null);
      })
      .catch(() => setAppDisabled(false))
      .finally(() => setStatusLoading(false));
  }, [projectKey]);

  if (activeRoute === null || statusLoading) {
    return (
      <Box padding="space.400">
        <Spinner size="large" label={UI_COPY.loading} />
      </Box>
    );
  }

  return (
    <Box padding="space.400">
      <Stack space="space.300">
      {!projectKey ? (
        <SectionMessage appearance="warning" title="Cần mở từ project">
          <Text>{UI_COPY.noProject}</Text>
        </SectionMessage>
      ) : null}

      {routeError ? (
        <SectionMessage appearance="warning" title="Điều hướng">
          <Text>{routeError}</Text>
        </SectionMessage>
      ) : null}

      {appDisabled ? (
        <SectionMessage appearance="warning" title="App chưa bật">
          <Text>{UI_COPY.disabled}</Text>
        </SectionMessage>
      ) : null}

      {!appDisabled && projectKey ? (
        <>
          <Box xcss={{ display: activeRoute === VIEW_DASHBOARD ? 'block' : 'none' }}>
            <DashboardView projectKey={projectKey} onLogStandup={goToLog} />
          </Box>

          {logViewMounted ? (
            <Box xcss={{ display: activeRoute === VIEW_LOG ? 'block' : 'none' }}>
              <LogStandupForm projectKey={projectKey} sprintName={sprintName} />
            </Box>
          ) : null}

          <Box xcss={{ display: activeRoute === VIEW_HISTORY ? 'block' : 'none' }}>
            <TeamHistoryView projectKey={projectKey} sprintName={sprintName} />
          </Box>

          <Box xcss={{ display: activeRoute === VIEW_SUMMARY ? 'block' : 'none' }}>
            <SprintSummaryView
              projectKey={projectKey}
              sprintName={sprintName}
              activeSprintStart={activeSprintStart}
            />
          </Box>
        </>
      ) : null}
      </Stack>
    </Box>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
