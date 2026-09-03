import { CtlxClientType } from "@shared-utils/client";

export type ResolveOrganizationIdParams = {
    organizationId: string | undefined;
    companyName: string | undefined | null;
    email: string;
    /** Seats given to an organization created by this integration. */
    allowedUsers: number;
    client: CtlxClientType;
};

/** Returns the ID of the organization with this exact name, or null if absent or lookup failed. */
async function findOrganizationByName(client: CtlxClientType, name: string): Promise<string | null> {
    const { data, error } = await client.GET("/v3/organizations", {
        params: { query: { name: { eq: name } } }
    });
    if (error) {
        console.error(`Organization search failed for name ${name}: ${error.message}`);
        return null;
    }
    return data[0]?.id ?? null;
}

/** Finds the organization by name, else creates it. Null if neither succeeds. */
async function insertOrganization(client: CtlxClientType, name: string, email: string, allowedUsers: number): Promise<string | null> {
    const existingId = await findOrganizationByName(client, name);
    if (existingId) {
        return existingId;
    }
    const { data, error } = await client.POST("/v3/organizations", {
        body: { name, email, allowedUsers }
    });
    if (error) {
        console.error(`Organization creation failed for name ${name}: ${error.message}`);
        // Two concurrent events may both try to create it.
        return await findOrganizationByName(client, name);
    }
    return data.id;
}

/**
 * Resolves the organization to assign a license to, creating it if missing.
 *
 * Order: metadata organization ID, then company name, then email domain.
 * Each step logs and falls through on failure; throws only if all fail.
 */
export async function resolveOrganizationId({ organizationId, companyName, email, allowedUsers, client }: ResolveOrganizationIdParams): Promise<string> {
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

    // Domains are case-insensitive, so lowercase them to avoid duplicates like "Example.com" and "example.com".
    const emailDomain = email.substring(email.lastIndexOf("@") + 1).trim().toLowerCase();
    const candidateNames = [companyName?.trim(), emailDomain].filter((name): name is string => !!name);
    for (const name of candidateNames) {
        const resolvedId = await insertOrganization(client, name, email, allowedUsers);
        if (resolvedId) {
            return resolvedId;
        }
    }

    throw new Error(`Failed to resolve organization for ${email}. Tried: ${candidateNames.join(", ")}.`);
}
