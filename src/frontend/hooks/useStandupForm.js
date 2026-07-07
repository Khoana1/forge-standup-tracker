import { useCallback, useMemo, useState } from 'react';
import { invoke } from '@forge/bridge';
import {
  extractJiraIssueKeys,
  extractPlainText,
  isStandupFieldEmpty,
  parseJiraLinkPaste,
  parseStandupFieldParts,
  readTextareaValue,
  stripJiraLinkPasteContent,
} from '../../lib/adf-helpers.js';
import { enrichStandupIssues } from '../components/ui.jsx';

const FIELD_NAMES = ['yesterday', 'today', 'blockers'];

const mergeIssues = (current, incoming) => {
  const merged = [...(current ?? [])];
  for (const item of incoming ?? []) {
    if (!merged.some((issue) => issue.key === item.key)) {
      merged.push(item);
    }
  }
  return merged;
};

const collectStoredIssueKeys = (entry) => {
  const keys = new Set(entry?.linkedIssueKeys ?? []);
  for (const field of FIELD_NAMES) {
    for (const key of extractJiraIssueKeys(entry?.[field])) {
      keys.add(key);
    }
    for (const issue of parseStandupFieldParts(entry?.[field]).issues) {
      keys.add(issue.key);
    }
  }
  return [...keys];
};

const syncFormField = (fieldProps, setValue, name, value) => {
  setValue(name, value);
  fieldProps.onChange?.({ target: { value } });
};

export const useStandupForm = ({ register, setValue, defaultBlockers = '' }) => {
  const [linkedIssues, setLinkedIssues] = useState([]);
  const [previews, setPreviews] = useState({
    yesterday: '',
    today: '',
    blockers: defaultBlockers,
  });

  const addLinkedIssues = useCallback(async (incoming) => {
    if (!incoming?.length) return;
    let merged = [];
    setLinkedIssues((prev) => {
      merged = mergeIssues(prev, incoming);
      return merged;
    });
    const enriched = await enrichStandupIssues(merged);
    setLinkedIssues(enriched);
  }, []);

  const removeLinkedIssue = useCallback((key) => {
    setLinkedIssues((prev) => prev.filter((issue) => issue.key !== key));
  }, []);

  const reorderLinkedIssues = useCallback((reorderedIssues) => {
    setLinkedIssues(reorderedIssues);
  }, []);

  const updateIssueStatus = useCallback(async (issueKey, nextStatus) => {
    try {
      await invoke('updateIssueStatus', {
        issueKey,
        statusCategory: nextStatus.category,
      });

      // Update local state
      setLinkedIssues((prev) =>
        prev.map((issue) =>
          issue.key === issueKey
            ? {
                ...issue,
                status: nextStatus.label,
                statusCategory: nextStatus.category,
              }
            : issue
        )
      );
    } catch (error) {
      console.error('Failed to update issue status:', error);
      throw error;
    }
  }, []);

  const absorbUrlsFromValue = useCallback(
    (name, rawValue, fieldProps) => {
      const found = parseJiraLinkPaste(rawValue);
      if (!found.length) return null;
      const stripped = stripJiraLinkPasteContent(rawValue);
      addLinkedIssues(found);
      setPreviews((prev) => ({ ...prev, [name]: stripped }));
      if (fieldProps) {
        syncFormField(fieldProps, setValue, name, stripped);
      } else {
        setValue(name, stripped);
      }
      return stripped;
    },
    [addLinkedIssues, setValue]
  );

  const bindField = useCallback(
    (name) => {
      const props = register(name);
      return {
        ...props,
        onChange: (event) => {
          const val = readTextareaValue(event);
          if (absorbUrlsFromValue(name, val, props) !== null) return;
          setPreviews((prev) => ({ ...prev, [name]: val }));
          return props.onChange(event);
        },
        onBlur: (event) => {
          const val = readTextareaValue(event);
          absorbUrlsFromValue(name, val, props);
          return props.onBlur?.(event);
        },
      };
    },
    [register, absorbUrlsFromValue]
  );

  const loadEntry = useCallback(
    async (entry) => {
      if (!entry) return;
      for (const name of FIELD_NAMES) {
        const { text } = parseStandupFieldParts(entry[name]);
        const plain = extractPlainText(text || entry[name]);
        setValue(name, plain);
        setPreviews((prev) => ({ ...prev, [name]: plain }));
      }

      const keys = collectStoredIssueKeys(entry);
      if (keys.length) {
        const enriched = await enrichStandupIssues(keys.map((key) => ({ key, url: '' })));
        setLinkedIssues(enriched);
      } else {
        setLinkedIssues([]);
      }
    },
    [setValue]
  );

  const canSubmit = useMemo(
    () => FIELD_NAMES.every((name) => !isStandupFieldEmpty(previews[name], [])),
    [previews]
  );

  const linkedIssueKeys = useMemo(() => linkedIssues.map((issue) => issue.key), [linkedIssues]);

  const absorbCellPaste = useCallback(
    (rawValue, onStripped) => {
      const found = parseJiraLinkPaste(rawValue);
      if (!found.length) return rawValue;
      addLinkedIssues(found);
      const stripped = stripJiraLinkPasteContent(rawValue);
      onStripped?.(stripped);
      return stripped;
    },
    [addLinkedIssues]
  );

  return {
    absorbCellPaste,
    addLinkedIssues,
    bindField,
    canSubmit,
    linkedIssueKeys,
    linkedIssues,
    loadEntry,
    removeLinkedIssue,
    reorderLinkedIssues,
    updateIssueStatus,
  };
};
