export function getCustomAttributes(item: any) {
  const customAttributes = item.attributes;
  const productId = customAttributes?.cryptlex_product_id;
  const licenseTemplateId = customAttributes?.cryptlex_license_template_id;
  const subscriptionInterval =
    customAttributes?.cryptlex_license_subscription_interval;
  const mappingsQuantity = customAttributes?.cryptlex_mappings_quantity;
  const isBundle = customAttributes?.is_bundle === "true";
  if ((productId && licenseTemplateId) || isBundle) {
    return {
      productId,
      licenseTemplateId,
      subscriptionInterval,
      mappingsQuantity,
      isBundle,
    };
  }
  throw new Error(
    `Attribute type does not conform to the required type for custom attribute of product: ${item.product} `
  );
}

export const SUBSCRIPTION_ID_METADATA_KEY = "fastspring_subscription_id";
export const ORDER_ID_METADATA_KEY = "fastspring_order_id";
export const DRIVER_METADATA_KEY = "fastspring_driver";
export const QUANTITY_MAPPING_MODE_LICENSE_COUNT = "total_licenses";
export const QUANTITY_MAPPING_MODE_ALLOWED_ACTIVATIONS = "allowed_activations";
