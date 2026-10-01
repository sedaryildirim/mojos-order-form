// Fetch helpers for the browser. A network failure must never throw out of a save handler:
// it becomes an ordinary error response, so the form keeps the user's typing and shows a message.

const OFFLINE_MESSAGE = "Could not reach the server. Check your connection and try again.";

export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const res = await fetch(input, init);
    // The session ended (for example the server restarted): ask for the password again.
    if (res.status === 401 && typeof window !== "undefined") window.location.reload();
    return res;
  } catch {
    return new Response(JSON.stringify({ error: OFFLINE_MESSAGE }), {
      status: 503,
      headers: { "content-type": "application/json", "x-network-error": "1" },
    });
  }
}

// The most useful message for a failed response: the server's own text when it sent one,
// a specific line for the common statuses, otherwise the caller's fallback.
export async function apiError(res: Response, fallback: string): Promise<string> {
  let serverMessage: string | null = null;
  try {
    const body = await res.clone().json();
    if (typeof body?.error === "string") serverMessage = body.error;
    else if (body?.error?.fieldErrors) {
      const first = Object.values(body.error.fieldErrors as Record<string, string[]>).flat()[0];
      if (first) serverMessage = first;
    }
  } catch {
    // not JSON: fall through
  }
  if (serverMessage) return serverMessage;
  if (res.status === 413) return "That file is too large.";
  if (res.status === 429) return "Too many requests. Wait a moment and try again.";
  if (res.status >= 500) return "The server had a problem. Try again in a moment.";
  return fallback;
}
