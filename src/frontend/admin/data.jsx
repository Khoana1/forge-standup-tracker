import React, { useCallback, useEffect, useState } from 'react';
import ForgeReconciler, {
  Button,
  Heading,
  Inline,
  SectionMessage,
  Spinner,
  Stack,
  Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const formatDateRange = (firstDate, lastDate) => {
  if (!firstDate) return '';
  if (firstDate === lastDate) return firstDate;
  return `${firstDate} → ${lastDate}`;
};

const MemberRow = ({ member, loading, confirmingId, onRequestDelete, onConfirmDelete, onCancel }) => {
  const isConfirming = confirmingId === member.accountId;
  const isDeleting = loading && confirmingId === member.accountId;

  return (
    <Stack space="space.100">
      <Inline spread="space-between" alignBlock="center">
        <Stack space="space.050">
          <Text weight="bold">{member.displayName}</Text>
          <Text size="small" color="color.text.subtle">
            {member.entryCount} bản ghi · {member.projectKeys.join(', ') || '—'}
          </Text>
          <Text size="small" color="color.text.subtle">
            {formatDateRange(member.firstDate, member.lastDate)}
          </Text>
        </Stack>
        {!isConfirming ? (
          <Button appearance="danger" onClick={() => onRequestDelete(member)}>
            Xóa dữ liệu
          </Button>
        ) : null}
      </Inline>
      {isConfirming ? (
        <SectionMessage appearance="warning" title="Không thể hoàn tác">
          <Stack space="space.100">
            <Text>
              Xóa toàn bộ {member.entryCount} bản ghi Team Sync của{' '}
              <Text weight="bold">{member.displayName}</Text>?
            </Text>
            <Inline space="space.100">
              <Button appearance="danger" onClick={() => onConfirmDelete(member)} isDisabled={isDeleting}>
                {isDeleting ? 'Đang xóa…' : 'Xác nhận xóa'}
              </Button>
              <Button onClick={onCancel} isDisabled={isDeleting}>
                Hủy
              </Button>
            </Inline>
          </Stack>
        </SectionMessage>
      ) : null}
    </Stack>
  );
};

const DataPrivacyPage = () => {
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [exportData, setExportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmingAll, setConfirmingAll] = useState(false);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    setError(null);
    try {
      const { members: nextMembers } = await invoke('getStandupDataMembers');
      setMembers(nextMembers ?? []);
    } catch (e) {
      setError(e?.message ?? 'Không tải được danh sách thành viên.');
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke('exportStandupData');
      setExportData(data);
    } catch (e) {
      setError(e?.message ?? 'Không xuất được dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (member) => {
    setLoading(true);
    setError(null);
    setDeleteSuccess(null);
    try {
      const result = await invoke('purgeMemberStandupData', { accountId: member.accountId });
      setMembers((prev) => prev.filter((m) => m.accountId !== member.accountId));
      setDeleteSuccess({
        displayName: member.displayName,
        deleted: result.deleted,
      });
      setConfirmingId(null);
      setExportData(null);
    } catch (e) {
      setError(e?.message ?? 'Không xóa được dữ liệu thành viên.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setLoading(true);
    setError(null);
    setDeleteSuccess(null);
    try {
      const result = await invoke('purgeStandupData', {
        confirm: 'DELETE_ALL_STANDUP_DATA',
      });
      setMembers([]);
      setDeleteSuccess({
        displayName: 'toàn bộ dữ liệu Team Sync',
        deleted: result.deleted,
      });
      setConfirmingAll(false);
      setConfirmingId(null);
      setExportData(null);
    } catch (e) {
      setError(e?.message ?? 'Không xóa được toàn bộ dữ liệu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack space="space.300">
      <Heading as="h2">Dữ liệu &amp; quyền riêng tư</Heading>
      <Text color="color.text.subtle">
        Xem và xóa dữ liệu Team Sync theo từng thành viên. Chỉ Jira administrator mới truy cập được
        trang này.
      </Text>

      {error ? <SectionMessage appearance="error">{error}</SectionMessage> : null}
      {deleteSuccess ? (
        <SectionMessage appearance="success">
          Đã xóa {deleteSuccess.deleted} bản ghi của {deleteSuccess.displayName}.
        </SectionMessage>
      ) : null}

      <Stack space="space.150">
        <Heading as="h3">Thành viên có dữ liệu</Heading>
        <Text size="small" color="color.text.subtle">
          Mỗi thành viên gồm mọi bản ghi Team Sync trên mọi project. Bấm「Xóa dữ liệu」để xóa toàn bộ
          bản ghi của người đó.
        </Text>
        {membersLoading ? (
          <Spinner label="Đang tải danh sách thành viên…" />
        ) : members.length === 0 ? (
          <SectionMessage appearance="information">
            <Text>Chưa có thành viên nào có dữ liệu Team Sync.</Text>
          </SectionMessage>
        ) : (
          <Stack space="space.200">
            {members.map((member) => (
              <MemberRow
                key={member.accountId}
                member={member}
                loading={loading}
                confirmingId={confirmingId}
                onRequestDelete={(m) => setConfirmingId(m.accountId)}
                onConfirmDelete={handleDeleteMember}
                onCancel={() => setConfirmingId(null)}
              />
            ))}
          </Stack>
        )}
      </Stack>

      <Stack space="space.150">
        <Heading as="h3">Xuất dữ liệu</Heading>
        <Text size="small" color="color.text.subtle">
          Tải bản sao JSON gồm cài đặt và toàn bộ bản ghi Team Sync (tuân thủ / sao lưu).
        </Text>
        <Button appearance="primary" onClick={handleExport} isDisabled={loading}>
          Xuất toàn bộ dữ liệu
        </Button>
        {exportData ? (
          <SectionMessage appearance="information" title="Đã xuất">
            <Text>
              {exportData.entryCount} bản ghi lúc {exportData.exportedAt}. Sao chép JSON bên dưới.
            </Text>
          </SectionMessage>
        ) : null}
        {exportData ? <Text>{JSON.stringify(exportData, null, 2).slice(0, 4000)}…</Text> : null}
      </Stack>

      <Stack space="space.150">
        <Heading as="h3">Xóa toàn bộ dữ liệu</Heading>
        <Text size="small" color="color.text.subtle">
          Xóa mọi bản ghi Team Sync trên site này. Cài đặt ứng dụng và cấu hình team vẫn được giữ
          lại.
        </Text>
        {!confirmingAll ? (
          <Button
            appearance="danger"
            onClick={() => {
              setConfirmingAll(true);
              setConfirmingId(null);
            }}
            isDisabled={loading || members.length === 0}
          >
            Xóa toàn bộ dữ liệu
          </Button>
        ) : (
          <SectionMessage appearance="warning" title="Không thể hoàn tác">
            <Stack space="space.100">
              <Text>
                Hành động này sẽ xóa toàn bộ bản ghi Team Sync của mọi thành viên trên site này.
              </Text>
              <Inline space="space.100">
                <Button appearance="danger" onClick={handleDeleteAll} isDisabled={loading}>
                  {loading ? 'Đang xóa…' : 'Xác nhận xóa toàn bộ'}
                </Button>
                <Button onClick={() => setConfirmingAll(false)} isDisabled={loading}>
                  Hủy
                </Button>
              </Inline>
            </Stack>
          </SectionMessage>
        )}
      </Stack>

      <Stack space="space.100">
        <Heading as="h3">Thông báo quyền riêng tư</Heading>
        <Text size="small">
          Dữ liệu Team Sync lưu trong Forge app storage, tách theo từng Jira site. Bao gồm account
          ID, tên hiển thị và nội dung sync. Không gửi cho bên thứ ba. Thời gian lưu trữ cấu hình
          tại General Settings.
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
