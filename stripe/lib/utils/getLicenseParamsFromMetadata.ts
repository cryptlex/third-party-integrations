import Stripe from "stripe";

export const PRODUCT_ID_KEY = 'CRYPTLEX_PRODUCT_ID';
export const LICENSE_TEMPLATE_KEY = 'CRYPTLEX_LICENSE_TEMPLATE';

/**
 * Extracts the Cryptlex product ID and license template ID required for license creation
 * from the metadata of a Stripe object (checkout session).
 */
export function getLicenseParamsFromMetadata(metadata: Stripe.Metadata | null | undefined): { productId: string, licenseTemplateId: string } {
    const productId = metadata?.[PRODUCT_ID_KEY];
    const licenseTemplateId = metadata?.[LICENSE_TEMPLATE_KEY];

    if (!productId) {
        throw new Error(`${PRODUCT_ID_KEY} not found in metadata.`);
    }
    if (!licenseTemplateId) {
        throw new Error(`${LICENSE_TEMPLATE_KEY} not found in metadata.`);
    }
    return { productId, licenseTemplateId };
}
