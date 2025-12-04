import { components } from "@cryptlex/web-api-types/production";
import { HandlerReturn } from ".";
import { CtlxClientType } from "./client";

export  const   createLicense = async (client:CtlxClientType, body:any): HandlerReturn =>
{
    const license = await client.POST("/v3/licenses", {
        body,
      });
      if (license.error) {
        throw new Error(
          `License creation failed with error: ${license.error.code} ${license.error.message}. User with ID ${body.userId} has been created.`
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
export async function getLicenseTemplate(client: CtlxClientType, licenseTemplateId: string): Promise<any> {
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
