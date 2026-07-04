/**
 * CORS Headers Utility
 *
 * Provides CORS headers for cross-origin requests between Vercel frontend and Railway backend.
 */

// Allowed origins - add your Vercel deployment URLs here
const getAllowedOrigins = (): string[] => {
  const origins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://vortexdl.vercel.app',
    // Add your Vercel preview/production URLs
    process.env.ALLOWED_ORIGIN,
  ].filter(Boolean) as string[];

  // If NEXT_PUBLIC_API_URL is set, extract the frontend origin from it
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }

  return origins;
};

export const getCorsHeaders = (requestOrigin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();

  // Check if the request origin is allowed
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin)
    ? requestOrigin
    : allowedOrigins[0] || '*';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
};

// Standard headers for JSON responses
export const jsonHeaders = (requestOrigin: string | null): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...getCorsHeaders(requestOrigin),
});

// Handle OPTIONS preflight requests
export const handleOptions = (requestOrigin: string | null): Response => {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(requestOrigin),
  });
};
