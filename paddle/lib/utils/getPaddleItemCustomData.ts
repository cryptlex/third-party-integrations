import { TransactionLineItemNotification } from "@paddle/paddle-node-sdk";

export type PaddleItemCustomData = {
  productId: string;
  licenseTemplateId: string;
};

/**
 * Read Cryptlex mapping from Paddle line item product.custom_data.
 * Same idea as FastSpring getCustomAttributes from item attributes.
 * @throws Error if product.custom_data is missing cryptlex_product_id or cryptlex_license_template_id
 */
export function getPaddleItemCustomData(item: TransactionLineItemNotification): PaddleItemCustomData {
  const customData = item.product?.customData;
  const productId = customData?.['cryptlex_product_id'];
  const licenseTemplateId = customData?.['cryptlex_license_template_id'];

  if (!productId || !licenseTemplateId) { 
    throw new Error(
      `Product custom_data must include cryptlex_product_id and cryptlex_license_template_id for product: ${item?.product?.id ?? 'unknown'}.`
    );
  }

  return { productId, licenseTemplateId };
}
