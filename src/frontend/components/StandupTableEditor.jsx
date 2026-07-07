import React from 'react';
import {
  Box,
  Button,
  FormSection,
  Inline,
  Text,
  TextArea,
  Textfield,
} from '@forge/react';
import { STANDUP_PLACEHOLDER, STANDUP_TABLE_HEADERS } from '../../lib/labels.js';
import { getSharedTextareaMinRows } from '../../lib/standup-rows.js';

const MIN_TEXTAREA_ROWS = 2;

/**
 * Khớp mockup daily_report_table_plain_progress.html:
 * # 36px · Tasks 38% · Progress 18% · Problems phần còn lại · cột xóa 36px
 */
const TABLE_GRID = '36px 38% 18% minmax(0, 1fr) 36px';

const tableGridStyle = {
  display: 'grid',
  gridTemplateColumns: TABLE_GRID,
  width: '100%',
  alignItems: 'start',
};

const cellPadding = {
  paddingBlock: 'space.150',
  paddingInline: 'space.100',
};

const rowBorderBottom = {
  borderBottomWidth: 'border.width',
  borderBottomStyle: 'solid',
  borderBottomColor: 'color.border',
};

export const StandupTableEditor = ({
  rows,
  onChange,
  onAddRow,
  onRemoveRow,
  onCellBlur,
  minRows = 1,
  maxRows = 20,
  description,
}) => {
  const updateCell = (rowId, field, value) => {
    onChange(
      rows.map((row) => (row.id === rowId ? { ...row, [field]: value } : row))
    );
  };

  const atMaxRows = rows.length >= maxRows;
  const atMinRows = rows.length <= minRows;

  return (
    <FormSection
      title="Báo cáo hôm nay"
      description={
        description ??
        'Bảng Tasks / Progress / Problems — Progress ghi ngắn (Đúng tiến độ, Chậm, Trễ…). Mặc định 3 hàng.'
      }
    >
      <Box
        xcss={{
          width: '100%',
          borderWidth: 'border.width',
          borderStyle: 'solid',
          borderColor: 'color.border',
          borderRadius: 'radius.large',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          backgroundColor="color.background.neutral.subtle"
          xcss={{
            ...tableGridStyle,
            ...rowBorderBottom,
          }}
        >
          <Box xcss={cellPadding}>
            <Text size="small" weight="medium" color="color.text.subtle">
              #
            </Text>
          </Box>
          {['tasks', 'progress', 'problems'].map((key) => (
            <Box key={key} xcss={cellPadding}>
              <Text size="small" weight="medium" color="color.text.subtle">
                {STANDUP_TABLE_HEADERS[key]}
              </Text>
            </Box>
          ))}
          <Box xcss={cellPadding} />
        </Box>

        {/* Body rows */}
        {rows.map((row, index) => {
          const sharedMinRows = getSharedTextareaMinRows(row, MIN_TEXTAREA_ROWS);
          const isLastRow = index === rows.length - 1;

          return (
            <Box
              key={row.id}
              xcss={{
                ...tableGridStyle,
                ...(isLastRow ? {} : rowBorderBottom),
              }}
            >
              <Box xcss={cellPadding}>
                <Text size="small" color="color.text.subtle">
                  {index + 1}
                </Text>
              </Box>

              <Box xcss={{ ...cellPadding, minWidth: 0 }}>
                <TextArea
                  value={row.tasks ?? ''}
                  minimumRows={sharedMinRows}
                  placeholder={STANDUP_PLACEHOLDER.tasks}
                  onChange={(event) => {
                    updateCell(row.id, 'tasks', event?.target?.value ?? '');
                  }}
                  onBlur={(event) => {
                    const value = event?.target?.value ?? '';
                    onCellBlur?.(row.id, 'tasks', value, (stripped) => {
                      updateCell(row.id, 'tasks', stripped);
                    });
                  }}
                />
              </Box>

              <Box xcss={{ ...cellPadding, minWidth: 0 }}>
                <Textfield
                  value={row.progress ?? ''}
                  placeholder={STANDUP_PLACEHOLDER.progress}
                  onChange={(event) => {
                    updateCell(row.id, 'progress', event?.target?.value ?? '');
                  }}
                  onBlur={(event) => {
                    const value = event?.target?.value ?? '';
                    onCellBlur?.(row.id, 'progress', value, (stripped) => {
                      updateCell(row.id, 'progress', stripped);
                    });
                  }}
                />
              </Box>

              <Box xcss={{ ...cellPadding, minWidth: 0 }}>
                <TextArea
                  value={row.problems ?? ''}
                  minimumRows={sharedMinRows}
                  placeholder={STANDUP_PLACEHOLDER.problems}
                  onChange={(event) => {
                    updateCell(row.id, 'problems', event?.target?.value ?? '');
                  }}
                  onBlur={(event) => {
                    const value = event?.target?.value ?? '';
                    onCellBlur?.(row.id, 'problems', value, (stripped) => {
                      updateCell(row.id, 'problems', stripped);
                    });
                  }}
                />
              </Box>

              <Box
                xcss={{
                  ...cellPadding,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                }}
              >
                <Button
                  appearance="subtle"
                  spacing="compact"
                  iconBefore="editor-close"
                  isDisabled={atMinRows}
                  onClick={() => onRemoveRow(row.id)}
                />
              </Box>
            </Box>
          );
        })}
      </Box>

      <Inline space="space.100" alignBlock="center">
        <Button appearance="default" onClick={onAddRow} isDisabled={atMaxRows}>
          Thêm hàng
        </Button>
        {atMaxRows ? (
          <Text size="small" color="color.text.subtle">
            Tối đa {maxRows} hàng.
          </Text>
        ) : null}
      </Inline>
    </FormSection>
  );
};
