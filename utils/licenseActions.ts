import { components } from "@cryptlex/web-api-types/production";
import { HandlerReturn } from ".";
import { CtlxClientType } from "./client";

export  const   createLicense = async (client:CtlxClientType, body:any): HandlerReturn =>
{
    const license = await client.POST("/v3/licenses", {
        body,
      });
      if (license.error) {
        // A license is assigned to either a user or an organization, so only name the one that was resolved.
        // The assignee may have already existed, so this does not claim it was created.
        const assignee = body.userId
          ? `User with ID ${body.userId} has been resolved.`
          : body.organizationId
            ? `Organization with ID ${body.organizationId} has been resolved.`
            : "No user or organization was resolved for the license.";
        throw new Error(
          `License creation failed with error: ${license.error.code} ${license.error.message}. ${assignee}`
        );
      }
      return {
        message: "License created successfully.",
        data: { license: license.data },
        status: 201,
      };
}

/** Get ID of a License that has the subscription ID saved in metadata  */
export async function getLicensesBySubscriptionId(client:CtlxClientType,subscriptionId: string, subscriptionIdMetadataKey:string):Promise<components["schemas"]["LicenseDto"][]> {
    const licenses = await client.GET('/v3/licenses',
        {
            params:
            {
                query: { "metadata.key": {eq: subscriptionIdMetadataKey}, "metadata.value": {eq:subscriptionId} }
            }
        }
    )
    if (licenses.error)
    {
        throw new Error(`Failed to get license(s) with subscriptionId: ${subscriptionId}`);

    }
    if (licenses.data.length > 0) {
        return licenses.data
    } else {
        throw new Error(`No license found with subscriptionId: ${subscriptionId}`);
    }
}

/**
 * Get license template by ID via client.
 * @param client
 * @param licenseTemplateId
 * @returns The license template object or throws error if not found.
 */
export async function getLicenseTemplate(client: CtlxClientType, licenseTemplateId: string): Promise<components["schemas"]["LicensePolicyDto"]> {
    const response = await client.GET("/v3/license-templates/{id}", {
        params: {
            path: { id: licenseTemplateId }
        }
    });
    if (response.error) {
        throw new Error(`Failed to get license template with id: ${licenseTemplateId}. ${response.error.code ? `${response.error.code}: ${response.error.message}` : ""}`);
    }
    return response.data;
}
