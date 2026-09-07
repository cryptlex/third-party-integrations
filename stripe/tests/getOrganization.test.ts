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
    customerName: "Jenny Rosen",
    allowedUsers: 5
};

test("creating an organization also creates an organization-admin user linked to it", async () => {
    let createdUser: any = null;
    server.use(
        // No organization with this name yet.
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json({ id: "org_1" }, { status: 201 })),
        // No user with this email yet.
        http.get(`${MswBaseUrl}/v3/users`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/users`, async ({ request }) => {
            createdUser = await request.json();
            return HttpResponse.json({ id: "user_1" }, { status: 201 });
        })
    );

    const organizationId = await insertOrganization({ ...params, client: client() });

    expect(organizationId).toBe("org_1");
    expect(createdUser).toMatchObject({
        email: "jenny@acme.com",
        firstName: "Jenny Rosen",
        role: "organization-admin",
        organizationId: "org_1"
    });
});

test("an existing user is moved into the new organization and promoted to admin", async () => {
    let patchedUser: any = null;
    let patchedUserId: string | null = null;
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json({ id: "org_1" }, { status: 201 })),
        http.get(`${MswBaseUrl}/v3/users`, () => HttpResponse.json([{ id: "user_existing" }])),
        http.patch(`${MswBaseUrl}/v3/users/:id`, async ({ request, params: pathParams }) => {
            patchedUserId = pathParams["id"] as string;
            patchedUser = await request.json();
            return HttpResponse.json({ id: patchedUserId });
        })
    );

    await insertOrganization({ ...params, client: client() });

    expect(patchedUserId).toBe("user_existing");
    expect(patchedUser).toMatchObject({ organizationId: "org_1", role: "organization-admin" });
});

test("an existing organization does not get a new admin", async () => {
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([{ id: "org_existing" }])),
        // Any user call here would be an unhandled request and fail the test.
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.error())
    );

    expect(await insertOrganization({ ...params, client: client() })).toBe("org_existing");
});

test("a failure creating the admin fails organization resolution", async () => {
    server.use(
        http.get(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/organizations`, () => HttpResponse.json({ id: "org_1" }, { status: 201 })),
        http.get(`${MswBaseUrl}/v3/users`, () => HttpResponse.json([])),
        http.post(`${MswBaseUrl}/v3/users`, () => HttpResponse.json({ message: "nope" }, { status: 400 }))
    );

    await expect(insertOrganization({ ...params, client: client() })).rejects.toThrow(
        /Organization admin creation failed for jenny@acme.com/
    );
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
