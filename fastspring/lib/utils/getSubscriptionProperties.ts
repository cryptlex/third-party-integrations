import { CtlxClientType } from "@shared-utils/client";
import { getLicenseTemplate } from "@shared-utils/licenseActions";
import { subscriptionProperties } from "../eventHandlers/handleOrderCreated";
export async function getSubscriptionProperties(subscription:string, items:any[], parentSubscriptionPropertiesDictionary:Record<string, subscriptionProperties>, client: CtlxClientType) {
    const parentSubscriptionProperties = parentSubscriptionPropertiesDictionary[subscription];
    if (parentSubscriptionProperties) {
        return parentSubscriptionProperties;
    } else {
        const item = items.find((item: any) => item.subscription.id === subscription);
        if (!item) {
            throw Error(`Parent subscription${subscription} not found in items`);
        }
        const template = await getLicenseTemplate(client, item.attributes.cryptlex_license_template_id);
        parentSubscriptionPropertiesDictionary[subscription] = { subscriptionInterval: item?.attributes?.cryptlex_license_subscription_interval ?? template.subscriptionInterval, subscriptionStartTrigger: template.subscriptionStartTrigger };
        return parentSubscriptionPropertiesDictionary[subscription];
    }
}