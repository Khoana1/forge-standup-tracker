const environment = process.env.FORGE_ENV ?? 'development';

export const createLogger = (module) => {
  const log = (level, message, data = {}) => {
    if (level === 'debug' && environment === 'production') return;
    console.log(
      JSON.stringify({
        level,
        message,
        module,
        timestamp: new Date().toISOString(),
        environment,
        ...data,
      })
    );
  };

  return {
    debug: (msg, data) => log('debug', msg, data),
    info: (msg, data) => log('info', msg, data),
    warn: (msg, data) => log('warn', msg, data),
    error: (msg, data) => log('error', msg, data),
    timer: (operation) => {
      const start = Date.now();
      return {
        end: (extraData = {}) => {
          log('info', `${operation} completed`, {
            ...extraData,
            durationMs: Date.now() - start,
          });
        },
        fail: (err, extraData = {}) => {
          log('error', `${operation} failed`, {
            ...extraData,
            durationMs: Date.now() - start,
            error: err?.message ?? String(err),
          });
        },
      };
    },
  };
};
