import { ContentfulStatusCode } from "hono/utils/http-status";

export type HandlerReturn = Promise<{
    /** HTTP Status */
    status: ContentfulStatusCode;
    /** Message in JSON body */
    message: string;
    /** JSON Data */
    data?: any;
}>;