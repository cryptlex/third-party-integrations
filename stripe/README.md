# @cryptlex/stripe-integration
A lightweight server application designed to handle `invoice.paid`, `checkout.session.completed`, `customer.created`, `customer.subscription.paused`, and `customer.subscription.resumed` events from Stripe. Upon receiving these webhooks, the server will automatically create, renew, suspend, or unsuspend licenses in Cryptlex, ensuring a seamless integration between Stripe payments and Cryptlex licenses.

## Endpoints
The application exposes two webhook endpoints:

- **`POST /v1`**: Creates licenses for a single Cryptlex product, configured via the `CRYPTLEX_PRODUCT_ID` environment variable.
- **`POST /v2`**: Supports multiple Cryptlex products and license templates. Instead of a fixed product ID, the Cryptlex product and license template are resolved per checkout session from Stripe metadata.

### Using /v2
Point your Stripe webhook to the `/v2` endpoint and add the following keys to the **metadata** of each Stripe Checkout Session:

- **CRYPTLEX_PRODUCT_ID**: The ID of the Cryptlex product for which the license should be created.
- **CRYPTLEX_LICENSE_TEMPLATE_ID**: The ID of the Cryptlex license template to use when creating the license. The older key name `CRYPTLEX_LICENSE_TEMPLATE` is still accepted for backward compatibility, but `CRYPTLEX_LICENSE_TEMPLATE_ID` takes precedence when both are present.
- **CRYPTLEX_ENTITLEMENT_SET_ID** (optional): The ID of the Cryptlex entitlement set to attach to the license.
- **CRYPTLEX_LICENSE_ASSIGNEE** (optional): Who the license is assigned to — `user` (default) or `organization`.
- **CRYPTLEX_ORGANIZATION_ID** (optional): The ID of the Cryptlex organization to assign the license to, used when `CRYPTLEX_LICENSE_ASSIGNEE` is `organization`.
- **CRYPTLEX_ALLOWED_USERS** (required when `CRYPTLEX_LICENSE_ASSIGNEE` is `organization`): The number of seats given to an organization created by this integration. Must be a positive integer.
- **CRYPTLEX_LICENSE_KEY** (optional): A custom license key. When omitted, Cryptlex auto-generates the key.

`CRYPTLEX_PRODUCT_ID` and `CRYPTLEX_LICENSE_TEMPLATE_ID` (or the legacy `CRYPTLEX_LICENSE_TEMPLATE`) are required — the webhook will fail if either is missing from the checkout session metadata. `CRYPTLEX_ENTITLEMENT_SET_ID` is optional and is only included when present. This allows a single deployment to issue licenses for different products, license templates, and entitlement sets based on what the customer purchased.

On `/v2`, license creation is handled exclusively by the `checkout.session.completed` event; the subscription's first `invoice.paid` event (billing reason `subscription_create`) is acknowledged without any action, and subsequent `invoice.paid` events (billing reason `subscription_cycle`) renew the license.

### Subscription pause & resume
`/v2` also handles two subscription lifecycle events:

- **`customer.subscription.paused`**: Suspends every Cryptlex license tagged with the subscription's ID.
- **`customer.subscription.resumed`**: Unsuspends those licenses.

Licenses are matched using the `stripe_subscription_id` license metadata key that is set at license creation. Enable both events on your Stripe webhook if you use Stripe's subscription pause collection feature.

### Assigning licenses to an organization
Set `CRYPTLEX_LICENSE_ASSIGNEE` to `organization` in the checkout session metadata to assign the license to a Cryptlex organization instead of a user. The organization is resolved in this order:

1. `CRYPTLEX_ORGANIZATION_ID` from the metadata, if present.
2. The customer's company name (`customer_details.business_name` on the checkout session).
3. The domain of the customer's email address.

For options 2 and 3, an existing organization with that exact name is reused; otherwise a new organization is created with `CRYPTLEX_ALLOWED_USERS` seats. A license is assigned to either a user or an organization, never both.

`CRYPTLEX_ALLOWED_USERS` is required whenever `CRYPTLEX_LICENSE_ASSIGNEE` is `organization` — the webhook fails if it is missing or is not a positive integer. It is ignored for `user` assignment, and it does not change the seat count of an organization that already exists.

> **Disable the `customer.created` webhook when using organization assignment.** That event creates a standalone Cryptlex user for the Stripe customer, which is redundant and conflicts with licenses that are owned by an organization.

## Requirements
To run this application, you must set the following environment variables in your hosting environment:

- **STRIPE_WEBHOOK_SECRET**: Your Stripe webhook secret, used to verify the authenticity of incoming Stripe events.
- **CRYPTLEX_ACCESS_TOKEN**: A valid Cryptlex API access token used to authenticate requests to the Cryptlex API. It requires the `license:read`, `license:write`, `user:read`, and `user:write` permissions, plus `organization:read` and `organization:write` when assigning licenses to organizations.
- **CRYPTLEX_WEB_API_BASE_URL**: The base URL of the Cryptlex Web API.
- **CRYPTLEX_PRODUCT_ID** (only required for `/v1`): The Cryptlex Product ID corresponding to the license you want to create or renew. Not used by `/v2`, which reads the product ID from the checkout session metadata instead.

## Installation & Usage
This project provides two preconfigured deployment targets based on your runtime environment:
- **AWS**: For running the server on AWS Lambda using GitHub Actions.
- **Node**: For running the server in a Node.js environment, including containerized deployments.

### AWS Lambda
To set up deployments on AWS Lambda, review the provided [aws.yml](../.github/workflows/aws.yml) GitHub Actions workflow. This file contains instructions for building, and deploying your application using GitHub Actions.

### Node
To run the application in a Node.js environment, including Docker-based workflows, refer to the [Dockerfile](../Dockerfile).

## Support
If you have questions, need assistance, or experience any issues, please feel free to reach out to our support team at [support@cryptlex.com](mailto:support@cryptlex.com). We’re here to help!
