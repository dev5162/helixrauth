export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "request_failed",
  ) {
    super(message);
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}
