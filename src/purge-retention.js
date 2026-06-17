import { createLogger } from './lib/logger.js';
import { getGlobalSettings, retentionCutoffDate } from './lib/settings.js';
import { deleteEntriesOlderThan } from './lib/standup-store.js';

const logger = createLogger('purge-retention');

export const run = async () => {
  const timer = logger.timer('scheduledRetentionPurge');
  try {
    const settings = await getGlobalSettings();
    const cutoff = retentionCutoffDate(settings.retentionDays);
    const result = await deleteEntriesOlderThan(cutoff);
    timer.end({
      action: 'scheduledRetentionPurge',
      retentionDays: settings.retentionDays,
      deleted: result.deleted,
      cutoffDate: cutoff,
    });
    return result;
  } catch (err) {
    timer.fail(err, { action: 'scheduledRetentionPurge' });
    throw err;
  }
};
