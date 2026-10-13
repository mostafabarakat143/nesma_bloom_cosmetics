export type AppErrorDetails = Array<{
  path: string;
  message: string;
}>;

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: AppErrorDetails;
  readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options?: {
      code?: string;
      details?: AppErrorDetails;
      isOperational?: boolean;
      cause?: unknown;
    },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options?.code ?? AppError.defaultCode(statusCode);
    this.details = options?.details;
    this.isOperational = options?.isOperational ?? true;
  }

  static badRequest(
    message: string,
    details?: AppErrorDetails,
    code = "BAD_REQUEST",
  ): AppError {
    return new AppError(400, message, { code, details });
  }

  static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED"): AppError {
    return new AppError(401, message, { code });
  }

  static forbidden(message = "Forbidden", code = "FORBIDDEN"): AppError {
    return new AppError(403, message, { code });
  }

  static notFound(message = "Resource not found", code = "NOT_FOUND"): AppError {
    return new AppError(404, message, { code });
  }

  static conflict(message: string, code = "CONFLICT"): AppError {
    return new AppError(409, message, { code });
  }

  static unprocessable(
    message: string,
    details?: AppErrorDetails,
    code = "UNPROCESSABLE_CONTENT",
  ): AppError {
    return new AppError(422, message, { code, details });
  }

  static tooManyRequests(
    message = "Too many requests",
    code = "TOO_MANY_REQUESTS",
  ): AppError {
    return new AppError(429, message, { code });
  }

  static internal(
    message = "Internal server error",
    code = "INTERNAL_SERVER_ERROR",
  ): AppError {
    return new AppError(500, message, { code, isOperational: false });
  }

  private static defaultCode(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return "BAD_REQUEST";
      case 401:
        return "UNAUTHORIZED";
      case 403:
        return "FORBIDDEN";
      case 404:
        return "NOT_FOUND";
      case 409:
        return "CONFLICT";
      case 422:
        return "UNPROCESSABLE_CONTENT";
      case 429:
        return "TOO_MANY_REQUESTS";
      default:
        return "INTERNAL_SERVER_ERROR";
    }
  }
}
