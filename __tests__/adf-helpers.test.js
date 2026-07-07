import {
  adfToPlainText,
  emptyAdf,
  extractJiraBrowseUrls,
  extractJiraIssueKeys,
  extractPlainText,
  isAdfDocument,
  isAdfJsonString,
  parseStandupField,
  parseJiraLinkPaste,
  parseStandupFieldParts,
  plainTextToAdf,
  serializeStandupField,
  serializeStandupFieldParts,
  serializeStandupText,
  stripJiraBrowseUrls,
  stripJiraLinkPasteContent,
  textToAdfWithSmartLinks,
} from '../src/lib/adf-helpers.js';

describe('adf-helpers', () => {
  it('creates empty ADF document', () => {
    const doc = emptyAdf();
    expect(isAdfDocument(doc)).toBe(true);
    expect(doc.content).toHaveLength(1);
    expect(doc.content[0].type).toBe('paragraph');
  });

  it('converts plain text to ADF and back', () => {
    const doc = plainTextToAdf('Line one\nLine two');
    expect(isAdfDocument(doc)).toBe(true);
    expect(adfToPlainText(doc)).toBe('Line one\nLine two');
  });

  it('parses legacy plain text standup fields', () => {
    const doc = parseStandupField('Finished API');
    expect(adfToPlainText(doc)).toBe('Finished API');
  });

  it('parses serialized ADF JSON strings', () => {
    const serialized = serializeStandupField(plainTextToAdf('With smart link'));
    expect(isAdfJsonString(serialized)).toBe(true);
    expect(extractPlainText(serialized)).toBe('With smart link');
  });

  it('extracts issue keys from Jira browse URLs', () => {
    const text =
      'https://example.atlassian.net/browse/SCRUM-1\nhttps://example.atlassian.net/browse/SCRUM-2';
    expect(extractJiraIssueKeys(text)).toEqual(['SCRUM-1', 'SCRUM-2']);
  });

  it('converts pasted Jira URLs to inlineCard ADF nodes', () => {
    const url = 'https://example.atlassian.net/browse/SCRUM-1';
    const doc = textToAdfWithSmartLinks(url);
    expect(doc.content[0].content).toEqual([
      { type: 'inlineCard', attrs: { url } },
    ]);
    expect(serializeStandupText(url)).toMatch(/inlineCard/);
  });

  it('parses multiple issue keys and URLs from paste', () => {
    const text = 'https://example.atlassian.net/browse/SCRUM-1\nSCRUM-2, SCRUM-3';
    expect(parseJiraLinkPaste(text).map((item) => item.key)).toEqual([
      'SCRUM-1',
      'SCRUM-2',
      'SCRUM-3',
    ]);
  });

  it('strips Jira browse URLs from text', () => {
    const url = 'https://example.atlassian.net/browse/SCRUM-1';
    expect(stripJiraBrowseUrls(`${url}\nDone task`)).toBe('Done task');
  });

  it('strips pasted issue keys and URLs from mixed text', () => {
    const url = 'https://example.atlassian.net/browse/SCRUM-1';
    expect(stripJiraLinkPasteContent(`${url}\nSCRUM-2\nKeep this`)).toBe('Keep this');
    expect(stripJiraLinkPasteContent('SCRUM-1, working on API')).toBe('working on API');
  });

  it('parses stored ADF into text and embedded issues', () => {
    const serialized = serializeStandupFieldParts('', [{ key: 'SCRUM-1', url: 'https://x/browse/SCRUM-1' }]);
    const parts = parseStandupFieldParts(serialized);
    expect(parts.issues).toEqual([{ key: 'SCRUM-1', url: 'https://x/browse/SCRUM-1' }]);
    expect(parts.text).toBe('');
  });

  it('extracts issue key from inline card nodes', () => {
    const doc = {
      version: 1,
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'inlineCard',
              attrs: { url: 'https://example.atlassian.net/browse/SCRUM-1' },
            },
          ],
        },
      ],
    };
    expect(extractPlainText(doc)).toBe('SCRUM-1');
  });

  it('returns empty string for blank serialized fields', () => {
    expect(serializeStandupField(emptyAdf())).toMatch(/^\{.*\}$/);
    expect(extractPlainText('')).toBe('');
  });
});
