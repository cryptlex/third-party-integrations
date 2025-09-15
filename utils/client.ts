import type { paths } from '@cryptlex/web-api-types/production';
import createClient, { Middleware } from 'openapi-fetch';

/**
 * @param accessToken Cryptlex Access Token
 * @returns openapi-fetch middleware for setting the Authorization header.
 */
export function getAuthMiddleware(accessToken: string): Middleware {
    return {
        async onRequest({ request }) {
            request.headers.set("Authorization", `Bearer ${accessToken}`);
            return request;
        },
    } satisfies Middleware;
}

// This is only here for the type, instantiate a client as per the use case in the correct env. 
const CtlxClient = createClient<paths>();
export type CtlxClientType = typeof CtlxClient;