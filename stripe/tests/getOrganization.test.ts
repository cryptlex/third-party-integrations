import createClient from "openapi-fetch";
import { http, HttpResponse } from "msw";
import type { paths } from "@cryptlex/web-api-types";
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { server } from "../../mock-server/node";
import { insertOrganization } from "../lib/utils/getOrganization";

// The generated mock server keeps its base URL private, so mirror it here.
const MswBaseUrl = "https://api.dev.cryptlex.co";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = () => createClient<paths>({ baseUrl: MswBaseUrl });

const params = {
    organizationId: undefined,
    companyName: "Acme Inc",
    email: "jenny@acme.com",
    allowedUsers: 5
};

test("a missing organization is created by name", async () => {
    let createdOrganization: any = null;
    server.use(
        // No organization with this name yet.
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/organizations`, async ({ request }) => {
            createdOrganization = await request.json();
            return HttpResponse.json({ id: "org_1" }, { status: 201 });
        })
    );

    expect(await insertOrganization({ ...params, client: client() })).toBe("org_1");
    expect(createdOrganization).toMatchObject({ name: "Acme Inc", email: "jenny@acme.com", allowedUsers: 5 });
});

test("an existing organization is reused", async () => {
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([{ id: "org_existing" }])),
        // Creating one here would mean the existing organization was ignored.
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.error())
    );

    expect(await insertOrganization({ ...params, client: client() })).toBe("org_existing");
});

test("a failure creating the organization is surfaced", async () => {
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json({ message: "nope" }, { status: 400 }))
    );

    await expect(insertOrganization({ ...params, client: client() })).rejects.toThrow(
        /Organization creation failed for name Acme Inc/
    );
});

test("a failure searching for the organization by name is surfaced", async () => {
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json({ message: "nope" }, { status: 400 }))
    );

    await expect(insertOrganization({ ...params, client: client() })).rejects.toThrow(
        /Organization search failed for name Acme Inc/
    );
});
