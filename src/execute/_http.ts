import type { DeleteExecutionFetchLike, DeleteExecutionFetchLikeResponse, DeleteExecutionLogger } from "./_types.js";

const _RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504]);
const _RETRY_LIMIT = 3;
const _RETRY_DELAY_MS = 1000;

export async function runWithRetry<T>(label: string, logger: DeleteExecutionLogger, run: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error) {
      attempt += 1;
      if (attempt > _RETRY_LIMIT || !_shouldRetryError(error)) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        `${label} failed on attempt ${attempt}/${_RETRY_LIMIT + 1}; retrying in ${_RETRY_DELAY_MS}ms - ${errorMessage}`
      );
      await sleep(_RETRY_DELAY_MS);
    }
  }
}

export function isRetryableStatus(status: number): boolean {
  return _RETRYABLE_STATUS_CODES.has(status);
}

export async function buildHttpErrorMessage(
  response: DeleteExecutionFetchLikeResponse,
  fallback: string
): Promise<string> {
  const details: string[] = [fallback, `status ${response.status}`];
  const body = await readJsonErrorBody(response);
  const message = typeof body?.message === "string" ? body.message : undefined;
  const documentationUrl = typeof body?.documentation_url === "string" ? body.documentation_url : undefined;
  const authenticateHeader = response.headers.get("www-authenticate") ?? undefined;

  if (message) {
    details.push(message);
  }
  if (documentationUrl) {
    details.push(documentationUrl);
  }
  if (authenticateHeader) {
    details.push(`www-authenticate: ${authenticateHeader}`);
  }

  return details.join(" - ");
}

export function buildTransportErrorMessage(error: unknown, fallback: string): string {
  const details = [fallback];
  if (error instanceof Error && error.message) {
    details.push(error.message);
  } else {
    details.push(String(error));
  }
  return details.join(" - ");
}

export function resolveFetch(fetchImpl?: DeleteExecutionFetchLike): DeleteExecutionFetchLike {
  return fetchImpl ?? fetch;
}

export function resolveJsonHeaders(response: DeleteExecutionFetchLikeResponse): string | undefined {
  return response.headers.get("content-type")?.split(";")[0];
}

async function readJsonErrorBody(response: DeleteExecutionFetchLikeResponse): Promise<
  | {
      message?: unknown;
      documentation_url?: unknown;
    }
  | undefined
> {
  const contentType = resolveJsonHeaders(response);
  if (contentType && contentType !== "application/json" && !contentType.endsWith("+json")) {
    return undefined;
  }

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      return body as { message?: unknown; documentation_url?: unknown };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function _shouldRetryError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|status 429|status 502|status 503|status 504/.test(error.message);
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
