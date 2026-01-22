import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

const normalizeBase = (base: string) => base.replace(/\/$/, "");

let detectedBaseUrl: string | null = null;
let baseUrlLogShown = false;

const detectBase = async (): Promise<string> => {
  // Return cached result if already detected
  if (detectedBaseUrl) {
    return detectedBaseUrl;
  }

  const envBase =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
    (typeof process !== "undefined" && process.env.VITE_API_BASE_URL);

  if (envBase) {
    let trimmed = normalizeBase(envBase);

    // If env URL uses localhost but we're accessing from a different IP, 
    // try to use the same hostname as the frontend (for network access)
    if (trimmed.includes("localhost") && typeof window !== "undefined") {
      const frontendHost = window.location.hostname;
      // Only replace if frontend is on a different IP (not localhost/127.0.0.1)
      if (frontendHost !== "localhost" && frontendHost !== "127.0.0.1") {
        trimmed = trimmed.replace("localhost", frontendHost);
        if (!baseUrlLogShown) {
          console.log("[api] Frontend on", frontendHost, "- using", trimmed, "for backend");
          baseUrlLogShown = true;
        }
      }
    }

    if (trimmed.endsWith("/api")) {
      detectedBaseUrl = trimmed;
      return detectedBaseUrl;
    }
    // Log only once on initialization
    if (!baseUrlLogShown) {
      console.log("[api] Using VITE_API_BASE_URL:", trimmed, "→ appending /api");
      baseUrlLogShown = true;
    }
    detectedBaseUrl = `${trimmed}/api`;
    return detectedBaseUrl;
  }

  // Check if we are in production. If so, do NOT fallback to localhost probing.
  // We assume the backend is available at /api or not at all.
  const isProd = (typeof import.meta !== "undefined" && (import.meta as any).env?.PROD);
  if (isProd) {
    if (!baseUrlLogShown) {
      console.log("[api] Production mode enabled. Defaulting to /api (no localhost fallback).");
      baseUrlLogShown = true;
    }
    detectedBaseUrl = "/api";
    return detectedBaseUrl;
  }

  // Fallback: probe ports 4000-4010 on localhost (backend is always on localhost)
  // This is only for DEVELOPMENT mode.
  const proto = "http:";
  const host = "localhost";

  for (let p = 4000; p <= 4010; p += 1) {
    const candidate = `${proto}//${host}:${p}/api`;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);
      const res = await fetch(`${candidate}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        detectedBaseUrl = candidate;
        if (!baseUrlLogShown) {
          console.log("[api] Detected backend at:", detectedBaseUrl);
          baseUrlLogShown = true;
        }
        return detectedBaseUrl;
      }
    } catch {
      continue;
    }
  }

  // Default fallback - always use localhost for backend
  detectedBaseUrl = "http://localhost:4001/api";
  if (!baseUrlLogShown) {
    console.log("[api] Using default backend URL:", detectedBaseUrl);
    baseUrlLogShown = true;
  }
  return detectedBaseUrl;
};

let apiClientPromise: Promise<AxiosInstance> | null = null;

const getApiClient = () => {
  if (!apiClientPromise) {
    apiClientPromise = detectBase().then((base) =>
      axios.create({
        baseURL: base,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
  return apiClientPromise;
};

type ApiResult<T> = { data: T | null; error: any };

export async function apiFetch<T>(
  path: string,
  init: AxiosRequestConfig & { body?: any } = {}
): Promise<ApiResult<T>> {
  const client = await getApiClient();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const payload =
    init.data ??
    (init.body
      ? typeof init.body === "string"
        ? (() => {
          try {
            return JSON.parse(init.body);
          } catch {
            return init.body;
          }
        })()
        : init.body
      : undefined);

  try {
    const res = await client.request({
      url: normalizedPath,
      method: init.method || "GET",
      data: payload,
      params: init.params,
      headers: init.headers,
    });
    const d: any = res.data;
    return { data: d?.data ?? d ?? null, error: d?.error ?? null };
  } catch (err: any) {
    // Provide more helpful error messages
    let message = "Request failed";

    if (err?.code === "ECONNREFUSED" || err?.message?.includes("ECONNREFUSED")) {
      message = "Cannot connect to backend server. Make sure the backend is running on port 4001.";
    } else if (err?.code === "ERR_NETWORK" || err?.message?.includes("Network Error")) {
      message = "Network error. Check if backend is running at http://localhost:4001";
    } else if (err?.response?.data?.error) {
      message = err.response.data.error;
    } else if (err?.message) {
      message = err.message;
    }

    console.error("[api] Request failed:", {
      url: err?.config?.url,
      baseURL: err?.config?.baseURL,
      method: err?.config?.method,
      error: err?.message,
      code: err?.code,
    });

    return { data: null, error: message };
  }
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) qs.append(key, String(value));
  });
  const suffix = qs.toString();
  return suffix ? `?${suffix}` : "";
}

export { getApiClient };
