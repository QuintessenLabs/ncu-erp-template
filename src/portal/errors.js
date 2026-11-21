// Error types used by the portal client. The server maps them to HTTP status codes.

/** The portal could not give us what we asked for (bad response, failure flag, network error). */
export class PortalError extends Error {
  constructor(message, { status = 502, cause } = {}) {
    super(message, { cause });
    this.name = 'PortalError';
    this.status = status;
  }
}

/** A problem with the request from our own client (bad input, unsupported body). Message is safe to show. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** The credentials were rejected, or the portal token is missing or expired. */
export class AuthError extends PortalError {
  constructor(message = 'Invalid username or password') {
    super(message, { status: 401 });
    this.name = 'AuthError';
  }
}
