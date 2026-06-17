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
} from '@forge/react';echo "# forge-standup-tracker" >> README.md
import { invoke, view } from '@forge/bridge';
import DashboardView from './DashboardView.jsx';
import {
  EmptyPrompt,
  HistoryEntryCard,
  PageHeader,
  StandupField,
  SurfaceCard,
} from '../components/ui.jsx';
import {
  DISPLAY_DATE_FORMAT,
  addDaysIso,
  isoToDisplay,
  mondayOfWeekIso,
  todayIso,
} from '../../lib/dates.js';
import {
  STANDUP_HINTS,
  STANDUP_LABELS_SHORT,
  STANDUP_PLACEHOLDER,
  STANDUP_TABLE_HEADERS,
  UI_COPY,
  formatTeamSyncTitle,
} from '../../lib/labels.js';

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
  const lower = (text ?? '').trim().toLowerCase();
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
  const { handleSubmit, register, getFieldId, setValue, formState } = useForm({
    defaultValues: { blockers: STANDUP_PLACEHOLDER.problems },
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [alreadyLogged, setAlreadyLogged] = useState(false);

  useEffect(() => {
    if (!projectKey) return;
    invoke('getMyStandupToday', { projectKey, date: todayIso() })
      .then(({ entry }) => {
        if (entry) {
          setAlreadyLogged(true);
          setValue('yesterday', entry.yesterday);
          setValue('today', entry.today);
          setValue('blockers', entry.blockers);
          setMessage('Bạn đã ghi Team Sync hôm nay. Gửi lại nếu muốn cập nhật nội dung.');
        }
      })
      .catch(() => {});
  }, [projectKey, setValue]);

  const onSubmit = async (data) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await invoke('submitStandup', {
        projectKey,
        yesterday: data.yesterday,
        today: data.today,
        blockers: data.blockers,
        date: todayIso(),
      });
      setAlreadyLogged(true);
      setMessage('Đã lưu Team Sync. Cảm ơn bạn!');
      onSubmitted?.();
    } catch (e) {
      setError(e?.message ?? 'Không lưu được Team Sync.');
    } finally {
      setSubmitting(false);
    }
  };

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
            Mẹo: ghi bullet ngắn, mỗi dòng một mục. Phần Problems gõ «Không có» nếu bạn không gặp
            trở ngại.
          </Text>
        </SectionMessage>
      )}

      <Form onSubmit={handleSubmit(onSubmit)}>
        <Stack space="space.200">
          {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
          {message ? <SectionMessage appearance="information">{message}</SectionMessage> : null}

          <StandupField
            step={1}
            label={STANDUP_LABELS_SHORT.tasks}
            hint={STANDUP_HINTS.tasks}
            placeholder={STANDUP_PLACEHOLDER.tasks}
            fieldId={getFieldId('yesterday')}
            registerProps={register('yesterday', { required: true })}
          />
          <StandupField
            step={2}
            label={STANDUP_LABELS_SHORT.progress}
            hint={STANDUP_HINTS.progress}
            placeholder={STANDUP_PLACEHOLDER.progress}
            fieldId={getFieldId('today')}
            registerProps={register('today', { required: true })}
          />
          <StandupField
            step={3}
            label={STANDUP_LABELS_SHORT.problems}
            hint={STANDUP_HINTS.problems}
            placeholder={STANDUP_PLACEHOLDER.problems}
            fieldId={getFieldId('blockers')}
            registerProps={register('blockers', { required: true })}
            minimumRows={2}
          />

          <FormFooter align="start">
            <LoadingButton
              type="submit"
              appearance="primary"
              isLoading={submitting}
              isDisabled={!formState.isValid}
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
  const [toDate, setToDate] = useState(todayIso);
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

const WeeklySummaryView = ({ projectKey, sprintName }) => {
  const [weekStart, setWeekStart] = useState(mondayOfWeekIso);
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
        weekStartDate: weekStart,
      });
      setSummary(result);
    } catch (e) {
      setError(e?.message ?? 'Không tạo được tổng kết tuần.');
    } finally {
      setLoading(false);
    }
  }, [projectKey, weekStart]);

  const handleWeekStartChange = (iso) => {
    setWeekStart(iso);
    setSummary(null);
    setError(null);
  };

  return (
    <Stack space="space.250">
      <PageHeader
        title={`Tổng kết tuần · ${formatTeamSyncTitle(sprintName)}`}
        subtitle="Chọn thứ Hai bắt đầu tuần, rồi bấm «Xem tổng kết» để xem Team Sync đã lưu."
      />

      <SurfaceCard>
        <Stack space="space.150">
          <StandupDatePicker
            id="week-start"
            label="Tuần bắt đầu (Thứ Hai)"
            value={weekStart}
            onChange={handleWeekStartChange}
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
          description="Chọn tuần và bấm «Xem tổng kết». Dữ liệu lấy từ các bản ghi Team Sync đã gửi."
          actionLabel="Xem tổng kết"
          onAction={generate}
        />
      ) : null}

      {loading ? <Spinner label="Đang tạo tổng kết…" /> : null}

      {summary ? (
        <Stack space="space.200">
          <SectionMessage appearance="information">
            <Text>
              Tuần {isoToDisplay(summary.weekStartDate)} · {summary.totalEntries} bản ghi ·{' '}
              {summary.blockerCount} có vấn đề
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
      })
      .catch(() => setAppDisabled(false))
      .finally(() => setStatusLoading(false));
  }, [projectKey]);

  if (activeRoute === null || statusLoading) {
    return <Spinner size="large" label={UI_COPY.loading} />;
  }

  return (
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

      {!appDisabled && projectKey && activeRoute === VIEW_DASHBOARD ? (
        <DashboardView projectKey={projectKey} onLogStandup={goToLog} />
      ) : null}
      {!appDisabled && projectKey && activeRoute === VIEW_LOG ? (
        <LogStandupForm projectKey={projectKey} sprintName={sprintName} />
      ) : null}
      {!appDisabled && projectKey && activeRoute === VIEW_HISTORY ? (
        <TeamHistoryView projectKey={projectKey} sprintName={sprintName} />
      ) : null}
      {!appDisabled && projectKey && activeRoute === VIEW_SUMMARY ? (
        <WeeklySummaryView projectKey={projectKey} sprintName={sprintName} />
      ) : null}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
