import { isValidDateKey, isValidProjectKey } from './keys.js';
import { extractPlainText } from './adf-helpers.js';

const MAX_FIELD_LENGTH = 5000;

const fieldError = (field, message) => ({ field, message });

export const validateStandupText = (value, fieldName) => {
  if (value === undefined || value === null) {
    return fieldError(fieldName, `${fieldName} is required`);
  }
  if (typeof value !== 'string' && typeof value !== 'object') {
    return fieldError(fieldName, `${fieldName} must be a string`);
  }
  const trimmed = extractPlainText(value);
  if (trimmed.length < 1) {
    return fieldError(fieldName, `${fieldName} cannot be empty`);
  }
  if (trimmed.length > MAX_FIELD_LENGTH) {
    return fieldError(fieldName, `${fieldName} must be at most ${MAX_FIELD_LENGTH} characters`);
  }
  return null;
};

const validateIssueKeyList = (keys, fieldName) => {
  if (keys === undefined || keys === null) return null;
  if (!Array.isArray(keys)) return fieldError(fieldName, `${fieldName} must be an array`);
  if (keys.length > 20) return fieldError(fieldName, `${fieldName} may contain at most 20 items`);
  for (const key of keys) {
    if (typeof key !== 'string' || !/^[A-Z][A-Z0-9]+-\d+$/.test(key.trim())) {
      return fieldError(fieldName, `Invalid issue key in ${fieldName}`);
    }
  }
  return null;
};

export const validateSubmitStandupPayload = (payload) => {
  const errors = [];
  const { projectKey, yesterday, today, blockers, date, linkedIssueKeys, contextIssueKey } =
    payload ?? {};

  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey must be a valid Jira project key (e.g. PROJ)'));
  }

  const dateToUse = date ?? new Date().toISOString().slice(0, 10);
  if (!isValidDateKey(dateToUse)) {
    errors.push(fieldError('date', 'date must be YYYY-MM-DD'));
  }

  for (const [field, value] of [
    ['yesterday', yesterday],
    ['today', today],
    ['blockers', blockers],
  ]) {
    const err = validateStandupText(value, field);
    if (err) errors.push(err);
  }

  const linkedErr = validateIssueKeyList(linkedIssueKeys, 'linkedIssueKeys');
  if (linkedErr) errors.push(linkedErr);

  if (contextIssueKey !== undefined && contextIssueKey !== null && contextIssueKey !== '') {
    if (typeof contextIssueKey !== 'string' || !/^[A-Z][A-Z0-9]+-\d+$/.test(contextIssueKey.trim())) {
      errors.push(fieldError('contextIssueKey', 'contextIssueKey must be a valid issue key'));
    }
  }

  return { valid: errors.length === 0, errors, date: dateToUse, projectKey: projectKey?.trim() };
};

export const validateHistoryPayload = (payload) => {
  const errors = [];
  const { projectKey, fromDate, toDate } = payload ?? {};

  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey is required'));
  }
  if (fromDate && !isValidDateKey(fromDate)) {
    errors.push(fieldError('fromDate', 'fromDate must be YYYY-MM-DD'));
  }
  if (toDate && !isValidDateKey(toDate)) {
    errors.push(fieldError('toDate', 'toDate must be YYYY-MM-DD'));
  }
  if (fromDate && toDate && fromDate > toDate) {
    errors.push(fieldError('toDate', 'toDate must be on or after fromDate'));
  }

  return { valid: errors.length === 0, errors };
};

export const validateWeeklySummaryPayload = (payload) => {
  const errors = [];
  const { projectKey, weekStartDate, sprintStartDate } = payload ?? {};
  const startDate = sprintStartDate ?? weekStartDate;

  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey is required'));
  }
  if (startDate && !isValidDateKey(startDate)) {
    errors.push(fieldError('sprintStartDate', 'sprintStartDate must be YYYY-MM-DD'));
  }

  return { valid: errors.length === 0, errors };
};

export const validateSettingsPayload = (payload) => {
  const errors = [];
  const {
    enabled,
    retentionDays,
    timezone,
    standupWindowTime,
    skipWeekends,
    weeklySummaryAuto,
    blockerAlertDays,
    notifyProjectAdminsOnProblem,
  } = payload ?? {};

  if (typeof enabled !== 'boolean') {
    errors.push(fieldError('enabled', 'enabled must be a boolean'));
  }

  const days = Number(retentionDays);
  if (!Number.isInteger(days) || days < 7 || days > 365) {
    errors.push(fieldError('retentionDays', 'retentionDays must be an integer between 7 and 365'));
  }

  if (typeof timezone !== 'string' || timezone.trim().length < 1 || timezone.length > 64) {
    errors.push(fieldError('timezone', 'timezone is required'));
  }

  if (
    standupWindowTime !== undefined &&
    (typeof standupWindowTime !== 'string' || !/^\d{2}:\d{2}$/.test(standupWindowTime))
  ) {
    errors.push(fieldError('standupWindowTime', 'standupWindowTime must be HH:MM'));
  }

  for (const [field, value] of [
    ['skipWeekends', skipWeekends],
    ['weeklySummaryAuto', weeklySummaryAuto],
  ]) {
    if (value !== undefined && typeof value !== 'boolean') {
      errors.push(fieldError(field, `${field} must be a boolean`));
    }
  }

  const alertDays = Number(blockerAlertDays);
  if (
    blockerAlertDays !== undefined &&
    (!Number.isInteger(alertDays) || alertDays < 0 || alertDays > 14)
  ) {
    errors.push(fieldError('blockerAlertDays', 'blockerAlertDays must be 0–14'));
  }

  if (
    notifyProjectAdminsOnProblem !== undefined &&
    typeof notifyProjectAdminsOnProblem !== 'boolean'
  ) {
    errors.push(
      fieldError('notifyProjectAdminsOnProblem', 'notifyProjectAdminsOnProblem must be a boolean')
    );
  }

  return { valid: errors.length === 0, errors };
};

export const validateResolveBlockerPayload = (payload) => {
  const errors = [];
  const { projectKey, date, accountId, resolutionPlan } = payload ?? {};
  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey is required'));
  }
  if (!isValidDateKey(date)) {
    errors.push(fieldError('date', 'date must be YYYY-MM-DD'));
  }
  if (typeof accountId !== 'string' || !accountId.trim()) {
    errors.push(fieldError('accountId', 'accountId is required'));
  }
  const plan = typeof resolutionPlan === 'string' ? resolutionPlan.trim() : '';
  if (plan.length < 3) {
    errors.push(
      fieldError('resolutionPlan', 'Phương án giải quyết phải có ít nhất 3 ký tự')
    );
  }
  return { valid: errors.length === 0, errors };
};

export const validateIssueSearchPayload = (payload) => {
  const errors = [];
  const { projectKey, query } = payload ?? {};
  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey is required'));
  }
  if (typeof query !== 'string' || query.trim().length < 1) {
    errors.push(fieldError('query', 'query is required'));
  }
  return { valid: errors.length === 0, errors };
};

export const validateIssueHistoryPayload = (payload) => {
  const errors = [];
  const { projectKey, issueKey } = payload ?? {};
  if (!isValidProjectKey(projectKey)) {
    errors.push(fieldError('projectKey', 'projectKey is required'));
  }
  if (typeof issueKey !== 'string' || !/^[A-Z][A-Z0-9]+-\d+$/.test(issueKey.trim())) {
    errors.push(fieldError('issueKey', 'issueKey is required'));
  }
  return { valid: errors.length === 0, errors };
};

export const validateTeamConfigPayload = (payload) => {
  const errors = [];
  const { enabledProjects } = payload ?? {};

  if (!Array.isArray(enabledProjects)) {
    errors.push(fieldError('enabledProjects', 'enabledProjects must be an array'));
    return { valid: false, errors };
  }

  if (enabledProjects.length > 50) {
    errors.push(fieldError('enabledProjects', 'At most 50 projects can be enabled'));
  }

  for (const key of enabledProjects) {
    if (!isValidProjectKey(key)) {
      errors.push(fieldError('enabledProjects', `Invalid project key: ${key}`));
      break;
    }
  }

  return { valid: errors.length === 0, errors };
};

export const validatePurgePayload = (payload) => {
  const { confirm } = payload ?? {};
  if (confirm !== 'DELETE_ALL_STANDUP_DATA') {
    return {
      valid: false,
      errors: [fieldError('confirm', 'Confirmation phrase is required')],
    };
  }
  return { valid: true, errors: [] };
};

export const validatePurgeMemberPayload = (payload) => {
  const accountId = String(payload?.accountId ?? '').trim();
  if (!accountId) {
    return {
      valid: false,
      errors: [fieldError('accountId', 'accountId is required')],
    };
  }
  return { valid: true, errors: [] };
};
