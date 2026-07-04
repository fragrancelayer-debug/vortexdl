/**
 * API Client Utility
 *
 * Handles dynamic API routing for hybrid Vercel + Railway deployment:
 * - If NEXT_PUBLIC_API_URL is set (Vercel), requests go to Railway backend
 * - Otherwise, requests use relative paths (local dev or full-stack Railway)
 */

const getApiBaseUrl = (): string => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/$/, ''); // Remove trailing slash
  }
  return ''; // Use relative paths
};

export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;

  // Merge default headers with provided headers
  const headers = new Headers(options.headers);

  // Add CORS headers for cross-origin requests
  if (baseUrl) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

// Convenience methods
export const apiPost = async <T>(endpoint: string, data: unknown): Promise<T> => {
  const res = await apiFetch(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(errorData.error || `HTTP error ${res.status}`);
  }

  return res.json();
};

export const apiGet = async (endpoint: string): Promise<Response> => {
  return apiFetch(endpoint, { method: 'GET' });
};

// Export the base URL for download links
export const getDownloadUrl = (params: URLSearchParams): string => {
  const baseUrl = getApiBaseUrl();
  return `${baseUrl}/api/download?${params.toString()}`;
};
