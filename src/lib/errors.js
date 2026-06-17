/** User-safe errors returned to the frontend. */
export const appError = (message, code = 'APP_ERROR') => {
  const err = new Error(message);
  err.code = code;
  err.isAppError = true;
  return err;
};

export const isAppError = (err) => Boolean(err?.isAppError);

export const toUserMessage = (err) => {
  if (isAppError(err)) return err.message;
  return err?.message || 'An unexpected error occurred. Please try again.';
};
