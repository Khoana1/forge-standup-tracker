export const emptyAdf = () => ({
  version: 1,
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
});

export const isAdfDocument = (value) =>
  Boolean(value && typeof value === 'object' && value.type === 'doc' && value.version);

export const isAdfJsonString = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return false;
  try {
    return isAdfDocument(JSON.parse(trimmed));
  } catch {
    return false;
  }
};

export const parseStandupField = (value) => {
  if (!value) return emptyAdf();
  if (isAdfDocument(value)) return value;
  if (typeof value !== 'string') return emptyAdf();

  const trimmed = value.trim();
  if (!trimmed) return emptyAdf();

  if (isAdfJsonString(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      if (isAdfDocument(parsed)) return parsed;
    } catch {
      // fall through to plain text
    }
  }

  return plainTextToAdf(trimmed);
};

export const serializeStandupField = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  if (isAdfDocument(value)) return JSON.stringify(value);
  return '';
};

export const plainTextToAdf = (text) => {
  const lines = String(text ?? '')
    .split('\n')
    .map((line) => line.trimEnd());

  if (!lines.length || (lines.length === 1 && !lines[0])) {
    return emptyAdf();
  }

  return {
    version: 1,
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
};

const walkAdfText = (nodes, parts) => {
  for (const node of nodes ?? []) {
    if (node.type === 'text') {
      parts.push(node.text ?? '');
      continue;
    }
    if (node.type === 'inlineCard' || node.type === 'blockCard') {
      const url = node.attrs?.url ?? '';
      const keyMatch = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
      parts.push(keyMatch ? keyMatch[1].toUpperCase() : url);
      continue;
    }
    if (node.type === 'hardBreak') {
      parts.push('\n');
      continue;
    }
    if (node.content?.length) {
      walkAdfText(node.content, parts);
    }
    if (node.type === 'paragraph') {
      parts.push('\n');
    }
  }
};

export const adfToPlainText = (value) => {
  const doc = isAdfDocument(value) ? value : parseStandupField(value);
  if (!isAdfDocument(doc)) return String(value ?? '').trim();

  const parts = [];
  walkAdfText(doc.content, parts);
  return parts
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const extractPlainText = (value) => {
  if (typeof value === 'string' && isAdfJsonString(value)) {
    return adfToPlainText(value);
  }
  if (isAdfDocument(value)) {
    return adfToPlainText(value);
  }
  return String(value ?? '').trim();
};

const JIRA_BROWSE_URL_RE = /https?:\/\/[^\s>]+\/browse\/([A-Z][A-Z0-9]+-\d+)/gi;
const JIRA_ISSUE_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

export const extractJiraIssueKeys = (value) => {
  const source = extractPlainText(value);
  const keys = new Set();
  let match;

  const urlRe = new RegExp(JIRA_BROWSE_URL_RE.source, 'gi');
  while ((match = urlRe.exec(source)) !== null) {
    keys.add(match[1].toUpperCase());
  }

  const keyRe = new RegExp(JIRA_ISSUE_KEY_RE.source, 'g');
  while ((match = keyRe.exec(source)) !== null) {
    keys.add(match[1].toUpperCase());
  }

  return [...keys];
};

/** Chỉ lấy key từ URL Jira — dùng khi preview live, tránh gọi API nhầm. */
export const extractJiraIssueKeysFromUrls = (value) => {
  const source = extractPlainText(value);
  const keys = new Set();
  let match;
  const urlRe = new RegExp(JIRA_BROWSE_URL_RE.source, 'gi');
  while ((match = urlRe.exec(source)) !== null) {
    keys.add(match[1].toUpperCase());
  }
  return [...keys];
};

export const readTextareaValue = (event) =>
  typeof event === 'string' ? event : event?.target?.value ?? '';

/** Nhận diện link Jira hoặc mã issue (mỗi dòng / dấu phẩy). */
export const parseJiraLinkPaste = (text) => {
  const items = extractJiraBrowseUrls(text);
  const seen = new Set(items.map((item) => item.key));
  for (const part of String(text ?? '').split(/[\n,]+/)) {
    const trimmed = part.trim();
    const match = trimmed.match(/^([A-Z][A-Z0-9]+-\d+)$/);
    if (match && !seen.has(match[1])) {
      seen.add(match[1]);
      items.push({ key: match[1], url: '' });
    }
  }
  return items;
};

export const extractJiraBrowseUrls = (text) => {
  const items = [];
  const urlRe = new RegExp(JIRA_BROWSE_URL_RE.source, 'gi');
  let match;
  while ((match = urlRe.exec(String(text ?? ''))) !== null) {
    items.push({ url: match[0], key: match[1].toUpperCase() });
  }
  return items;
};

export const stripJiraBrowseUrls = (text) =>
  String(text ?? '')
    .replace(new RegExp(JIRA_BROWSE_URL_RE.source, 'gi'), '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/^\n+/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const ISSUE_KEY_ONLY_RE = /^[A-Z][A-Z0-9]+-\d+$/;

/** Gỡ URL Jira và mã issue khỏi text sau khi đã chuyển sang danh sách liên kết. */
export const stripJiraLinkPasteContent = (text) => {
  const withoutUrls = stripJiraBrowseUrls(text);
  const lines = withoutUrls.split('\n');
  const cleaned = lines
    .map((line) =>
      line
        .split(',')
        .map((part) => part.trim())
        .filter((part) => part && !ISSUE_KEY_ONLY_RE.test(part))
        .join(', ')
        .trim()
    )
    .filter(Boolean);
  return cleaned.join('\n').trim();
};

/** Tách nội dung đã lưu thành text tự do + danh sách issue (từ inlineCard). */
export const parseStandupFieldParts = (value) => {
  const doc = parseStandupField(value);
  if (!isAdfDocument(doc)) {
    const plain = String(value ?? '');
    const urls = extractJiraBrowseUrls(plain);
    return {
      text: stripJiraBrowseUrls(plain),
      issues: urls.map(({ key, url }) => ({ key, url })),
    };
  }

  const textLines = [];
  const issues = [];
  for (const block of doc.content ?? []) {
    if (block.type !== 'paragraph') continue;
    const nodes = block.content ?? [];
    const cardNodes = nodes.filter(
      (node) => node.type === 'inlineCard' || node.type === 'blockCard'
    );
    if (cardNodes.length) {
      for (const node of cardNodes) {
        const url = node.attrs?.url ?? '';
        const keyMatch = url.match(/\/browse\/([A-Z][A-Z0-9]+-\d+)/i);
        if (keyMatch) {
          issues.push({ key: keyMatch[1].toUpperCase(), url });
        }
      }
      continue;
    }
    const line = nodes
      .filter((node) => node.type === 'text')
      .map((node) => node.text ?? '')
      .join('');
    if (line.trim()) textLines.push(line);
  }

  return { text: textLines.join('\n'), issues };
};

export const buildStandupAdfFromParts = (text, issues = []) => {
  const content = [];
  for (const issue of issues) {
    if (issue?.url) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'inlineCard', attrs: { url: issue.url } }],
      });
    }
  }

  const lines = String(text ?? '').split('\n');
  if (lines.length === 1 && !lines[0].trim() && !content.length) {
    return emptyAdf();
  }

  for (const line of lines) {
    content.push(paragraphFromLine(line));
  }

  if (!content.length) return emptyAdf();
  return { version: 1, type: 'doc', content };
};

export const serializeStandupFieldParts = (text, issues) =>
  serializeStandupField(buildStandupAdfFromParts(text, issues));

export const isStandupFieldEmpty = (text, issues) =>
  !String(text ?? '').trim() && !(issues?.length);

const paragraphFromLine = (line) => {
  const trimmed = line.trimEnd();
  if (!trimmed) {
    return { type: 'paragraph', content: [] };
  }

  const content = [];
  let lastIndex = 0;
  const urlRe = new RegExp(JIRA_BROWSE_URL_RE.source, 'gi');
  let match;

  while ((match = urlRe.exec(trimmed)) !== null) {
    if (match.index > lastIndex) {
      content.push({ type: 'text', text: trimmed.slice(lastIndex, match.index) });
    }
    content.push({
      type: 'inlineCard',
      attrs: { url: match[0] },
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < trimmed.length) {
    content.push({ type: 'text', text: trimmed.slice(lastIndex) });
  }

  if (!content.length) {
    content.push({ type: 'text', text: trimmed });
  }

  return { type: 'paragraph', content };
};

/** Chuyển plain text (có link Jira) sang ADF với inlineCard để hiển thị smart link. */
export const textToAdfWithSmartLinks = (text) => {
  const lines = String(text ?? '').split('\n').map((line) => line.trimEnd());
  if (!lines.length || (lines.length === 1 && !lines[0])) {
    return emptyAdf();
  }

  return {
    version: 1,
    type: 'doc',
    content: lines.map((line) => paragraphFromLine(line)),
  };
};

/** Serialize nội dung form (plain text) để lưu storage. */
export const serializeStandupText = (text, issues = []) => {
  if (issues?.length) return serializeStandupFieldParts(text, issues);
  return serializeStandupField(textToAdfWithSmartLinks(text));
};
