import { TransactionLineItemNotification } from "@paddle/paddle-node-sdk";

/**
 * Paddle transaction line item product shape (custom_data for Cryptlex mapping).
 */
export type PaddleItemProduct = {
  id: string;
  name?: string;
  custom_data?: {
    cryptlex_productId?: string;
    cryptlex_licenseTemplateId?: string;
  };
};

export type PaddleTransactionItem = {
  product: PaddleItemProduct;
  price_id: string;
  quantity: number;
};

export type PaddleItemCustomData = {
  productId: string;
  licenseTemplateId: string;
};

/**
 * Read Cryptlex mapping from Paddle line item product.custom_data.
 * Same idea as FastSpring getCustomAttributes from item attributes.
 * @throws Error if product.custom_data is missing cryptlex_productId or cryptlex_licenseTemplateId
 */
export function getPaddleItemCustomData(item: TransactionLineItemNotification): PaddleItemCustomData {
  const customData = item.product?.customData;
  const productId = customData?.['cryptlex_productId'];
  const licenseTemplateId = customData?.['cryptlex_licenseTemplateId'];

  if (!productId || !licenseTemplateId) { 
    throw new Error(
      `Product custom_data must include cryptlex_productId and cryptlex_licenseTemplateId for product: ${item?.product?.id ?? 'unknown'}.`
    );
  }

  return { productId, licenseTemplateId };
}
