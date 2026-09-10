import { CtlxClientType } from "@shared-utils/client";

export type InsertOrganizationParams = {
    organizationId: string | undefined;
    companyName: string | undefined | null;
    email: string;
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

/** Finds the organization by name, else creates it. Throws if either call fails. */
async function findOrCreateOrganization(client: CtlxClientType, name: string, email: string, allowedUsers: number): Promise<string> {
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
    return data.id;
}

/**
 * Returns the organization to assign a license to, creating it if missing.
 *
 * Order: metadata organization ID, then company name, then email domain.
 * A failed lookup by metadata organization ID falls through to the next step;
 * failures while resolving by company name or email domain throw.
 */
export async function insertOrganization({ organizationId, companyName, email, allowedUsers, client }: InsertOrganizationParams): Promise<string> {
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
        return await findOrCreateOrganization(client, name, email, allowedUsers);
    }

    // Domains are case-insensitive, so lowercase them to avoid duplicates like "Example.com" and "example.com".
    const emailDomain = email.substring(email.lastIndexOf("@") + 1).trim().toLowerCase();
    return await findOrCreateOrganization(client, emailDomain, email, allowedUsers);
}
