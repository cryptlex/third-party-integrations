import Stripe from "stripe";

export const PRODUCT_ID_KEY = 'CRYPTLEX_PRODUCT_ID';
export const LICENSE_TEMPLATE_KEY = 'CRYPTLEX_LICENSE_TEMPLATE';
export const ENTITLEMENT_SET_ID_KEY = 'CRYPTLEX_ENTITLEMENT_SET_ID';

/**
 * Extracts the Cryptlex product ID, license template ID, and (optionally) entitlement set ID
 * required for license creation from the metadata of a Stripe object (checkout session).
 */
export function getLicenseParamsFromMetadata(metadata: Stripe.Metadata | null | undefined): { productId: string, licenseTemplateId: string, entitlementSetId?: string } {
    const productId = metadata?.[PRODUCT_ID_KEY];
    const licenseTemplateId = metadata?.[LICENSE_TEMPLATE_KEY];
    const entitlementSetId = metadata?.[ENTITLEMENT_SET_ID_KEY];

    if (!productId) {
        throw new Error(`${PRODUCT_ID_KEY} not found in metadata.`);
    }
    if (!licenseTemplateId) {
        throw new Error(`${LICENSE_TEMPLATE_KEY} not found in metadata.`);
    }
    return { productId, licenseTemplateId, entitlementSetId };
}
