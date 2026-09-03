import Stripe from "stripe";
export const PRODUCT_ID_KEY = 'CRYPTLEX_PRODUCT_ID';
export const LICENSE_TEMPLATE_KEY = 'CRYPTLEX_LICENSE_TEMPLATE_ID';
export const ENTITLEMENT_SET_ID_KEY = 'CRYPTLEX_ENTITLEMENT_SET_ID';
export const ORGANIZATION_ID_KEY = 'CRYPTLEX_ORGANIZATION_ID';
export const ASSIGNEE_KEY = 'CRYPTLEX_LICENSE_ASSIGNEE';
export const LICENSE_KEY = 'CRYPTLEX_LICENSE_KEY';
export const ALLOWED_USERS_KEY = "CRYPTLEX_ALLOWED_USERS";

/** Who a created license is assigned to. */
export type LicenseAssignee = 'user' | 'organization';

export type LicenseParams = {
    productId: string;
    licenseTemplateId: string;
    entitlementSetId?: string;
    organizationId?: string;
    licenseAssignee?: LicenseAssignee;
    licenseKey?: string;
    allowedUsers: number;
};
/** Reads the Cryptlex license-creation params from a Stripe object's metadata. */
export function getLicenseParamsFromMetadata(metadata: Stripe.Metadata | null | undefined): LicenseParams {
    const productId = metadata?.[PRODUCT_ID_KEY];
    // Falls back to the older key name for backward compatibility.
    const licenseTemplateId = metadata?.[LICENSE_TEMPLATE_KEY] || metadata?.['CRYPTLEX_LICENSE_TEMPLATE'];
    const entitlementSetId = metadata?.[ENTITLEMENT_SET_ID_KEY];
    const organizationId = metadata?.[ORGANIZATION_ID_KEY];
    const licenseAssignee: LicenseAssignee = metadata?.[ASSIGNEE_KEY] === 'organization' ? 'organization' : 'user';
    const licenseKey = metadata?.[LICENSE_KEY];

    if (!productId) {
        throw new Error(`${PRODUCT_ID_KEY} not found in metadata.`);
    }
    if (!licenseTemplateId) {
        throw new Error(`${LICENSE_TEMPLATE_KEY} not found in metadata.`);
    }
    const allowedUsers = metadata?.[ALLOWED_USERS_KEY] ? parseInt(metadata[ALLOWED_USERS_KEY], 10) : 0;
    // Only organization assignment creates an organization, so only it needs the seat count.
    if (licenseAssignee === 'organization' && !(Number.isInteger(allowedUsers) && allowedUsers > 0)) {
        throw new Error(`${ALLOWED_USERS_KEY} must be a positive integer in metadata for organization license assignee.`);
    }
    return { productId, licenseTemplateId, entitlementSetId, organizationId, licenseAssignee, licenseKey, allowedUsers };
}
