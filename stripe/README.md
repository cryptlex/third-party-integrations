# @cryptlex/stripe-integration
A lightweight server application designed to handle `invoice.paid`, `checkout.session.completed`, and `customer.created` events from Stripe. Upon receiving these webhooks, the server will automatically create or renew licenses in Cryptlex, ensuring a seamless integration between Stripe payments and Cryptlex licenses.

## Endpoints
The application exposes two webhook endpoints:

- **`POST /v1`**: Creates licenses for a single Cryptlex product, configured via the `CRYPTLEX_PRODUCT_ID` environment variable.
- **`POST /v2`**: Supports multiple Cryptlex products and license templates. Instead of a fixed product ID, the Cryptlex product and license template are resolved per checkout session from Stripe metadata.

### Using /v2
Point your Stripe webhook to the `/v2` endpoint and add the following keys to the **metadata** of each Stripe Checkout Session:

- **CRYPTLEX_PRODUCT_ID**: The ID of the Cryptlex product for which the license should be created.
- **CRYPTLEX_LICENSE_TEMPLATE**: The ID of the Cryptlex license template to use when creating the license.

Both keys are required — the webhook will fail if either is missing from the checkout session metadata. This allows a single deployment to issue licenses for different products and license templates based on what the customer purchased.

On `/v2`, license creation is handled exclusively by the `checkout.session.completed` event; the subscription's first `invoice.paid` event (billing reason `subscription_create`) is acknowledged without any action, and subsequent `invoice.paid` events (billing reason `subscription_cycle`) renew the license.

## Requirements
To run this application, you must set the following environment variables in your hosting environment:

- **STRIPE_WEBHOOK_SECRET**: Your Stripe webhook secret, used to verify the authenticity of incoming Stripe events.
- **CRYPTLEX_ACCESS_TOKEN**: A valid Cryptlex API access token with the `license:read`, `license:write`, `user:read`, `user:write` permissions; used to authenticate requests to the Cryptlex API.
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
