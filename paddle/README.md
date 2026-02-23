# Paddle integration

A lightweight server application designed to handle `transaction.completed`, `subscription.paused`, and `customer.created` events from Paddle. Upon receiving these webhooks, the server will automatically create, renew, suspend, resume licenses in Cryptlex, ensuring a seamless integration between Paddle payments and Cryptlex licenses. Webhook payloads are verified using the Paddle SDK (`paddle.webhooks.unmarshal`); no Paddle API key is required.

## Requirements

To run this application, you must set the following environment variables in your hosting environment:

- **PADDLE_WEBHOOK_SECRET**: Your Paddle webhook secret, used to verify the authenticity of incoming Paddle events.
- **CRYPTLEX_WEB_API_BASE_URL**: The base URL of the Cryptlex Web API.
- **CRYPTLEX_ACCESS_TOKEN**: A valid Cryptlex API access token with the `license:read`, `license:write`, `user:read`, `user:write` permissions; used to authenticate requests to the Cryptlex API.

## Installation & Usage

This project provides two preconfigured deployment targets based on your runtime environment:
- **AWS**: For running the server on AWS Lambda using GitHub Actions.
- **Node**: For running the server in a Node.js environment, including containerized deployments.

### AWS Lambda

To set up deployments on AWS Lambda, review the provided [aws.yml](../.github/workflows/aws.yml) GitHub Actions workflow. This file contains instructions for building and deploying your application using GitHub Actions.

### Node

To run the application in a Node.js environment, including Docker-based workflows, refer to the [Dockerfile](../Dockerfile).

## Support

If you have questions, need assistance, or experience any issues, please feel free to reach out to our support team at [support@cryptlex.com](mailto:support@cryptlex.com). We're here to help!
