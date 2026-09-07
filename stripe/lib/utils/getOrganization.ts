import { nanoid } from "nanoid";
import { CtlxClientType } from "@shared-utils/client";

/** Role granted to the first user of an organization created by this integration. */
const ORGANIZATION_ADMIN_ROLE = "organization-admin";

export type InsertOrganizationParams = {
    organizationId: string | undefined;
    companyName: string | undefined | null;
    email: string;
    /** Name for the organization admin created alongside a new organization. */
    customerName: string;
    /** Seats given to an organization created by this integration. */
    allowedUsers: number;
    client: CtlxClientType;
};

/** Returns the ID of the organization with this exact name, or null if absent. Throws if the lookup fails. */
async function findOrganizationByName(client: CtlxClientType, name: string): Promise<string | null> {
    const { data, error } = await client.GET("/v3/organizations", {
        params: { query: { name: { eq: name } } }
    });
    if (error) {
        throw new Error(`Organization search failed for name ${name}: ${error.message}`);
    }
    return data[0]?.id ?? null;
}

/**
 * Makes the customer an admin of a newly created organization.
 *
 * A user with this email may already exist outside the organization, in which
 * case it is moved in and promoted instead of being created again. Any API
 * failure throws so the event is not reported as successful with a headless
 * organization left behind.
 */
async function insertOrganizationAdmin(client: CtlxClientType, organizationId: string, email: string, customerName: string): Promise<void> {
    const { data: existingUsers, error: searchError } = await client.GET("/v3/users", {
        params: { query: { email: { eq: email } } }
    });

    if (searchError) {
        throw new Error(`Organization admin lookup failed for ${email}: ${searchError.message}`);
    }

    const existingUser = existingUsers[0];
    
    if (existingUser) {
        const { error } = await client.PATCH("/v3/users/{id}", {
            params: { path: { id: existingUser.id } },
            body: { organizationId, role: ORGANIZATION_ADMIN_ROLE }
        });
        if (error) {
            throw new Error(`Organization admin promotion failed for ${email}: ${error.message}`);
        }
        return;
    }

    const { error } = await client.POST("/v3/users", {
        body: {
            email,
            firstName: customerName,
            password: nanoid(10),
            role: ORGANIZATION_ADMIN_ROLE,
            organizationId
        }
    });
    if (error) {
        throw new Error(`Organization admin creation failed for ${email}: ${error.message}`);
    }
}

/** Finds the organization by name, else creates it. Throws if either call fails. */
async function findOrCreateOrganization(client: CtlxClientType, name: string, email: string, customerName: string, allowedUsers: number): Promise<string> {
    const existingId = await findOrganizationByName(client, name);
    if (existingId) {
        return existingId;
    }

    const { data, error } = await client.POST("/v3/organizations", {
        body: { name, email, allowedUsers }
    });

    if (error) {
        throw new Error(`Organization creation failed for name ${name}: ${error.message}`);
    }
    // Only a brand new organization needs its admin seeded.
    await insertOrganizationAdmin(client, data.id, email, customerName);
    return data.id;
}

/**
 * Returns the organization to assign a license to, creating it if missing.
 *
 * Order: metadata organization ID, then company name, then email domain.
 * A failed lookup by metadata organization ID falls through to the next step;
 * failures while resolving by company name or email domain throw.
 */
export async function insertOrganization({ organizationId, companyName, email, customerName, allowedUsers, client }: InsertOrganizationParams): Promise<string> {
    if (organizationId) {
        const { data, error } = await client.GET("/v3/organizations/{id}", {
            params: { path: { id: organizationId } }
        });
        if (error) {
            console.error(`Organization lookup failed for id ${organizationId}: ${error.message}`);
        } else {
            return data.id;
        }
    }
    
    const name = companyName?.trim();
    if (name) {
        return await findOrCreateOrganization(client, name, email, customerName, allowedUsers);
    }

    // Domains are case-insensitive, so lowercase them to avoid duplicates like "Example.com" and "example.com".
    const emailDomain = email.substring(email.lastIndexOf("@") + 1).trim().toLowerCase();
    return await findOrCreateOrganization(client, emailDomain, email, customerName, allowedUsers);
}
