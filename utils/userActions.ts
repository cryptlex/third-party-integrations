import { nanoid } from "nanoid";
import { CtlxClientType } from './client';


async function checkUserExists(email: string, client: CtlxClientType) {
    let userId: string | null = null
    const userResponse = await client.GET('/v3/users', {
        params: {
            query: {
                email: { eq: email },
            },
        },
    })
    if (userResponse.error) {
        throw Error(`User search failed: ${userResponse.error.message}.`)
    }
    if (userResponse.data[0]) {
        userId = userResponse.data[0].id
    }
    return userId
}

async function createUser(email: string, customerName: string, client: CtlxClientType) {
    const user = await client.POST('/v3/users', {
        body: {
            email: email,
            firstName: customerName,
            password: nanoid(10),
            role: 'user',
        },
    });
    if (user.error) {
        throw Error(`User creation failed: ${user.error.message}`);
    }
    return user.data.id
}

async function updateUser(userId: string, customerName: string, client: CtlxClientType) {
    const user = await client.PATCH(`/v3/users/{id}`, {
        params: {
            path: {
                id: userId,
            },
        },
        body: {
            firstName: customerName
        }
    })
    if (user.error) {
        throw Error(`User updation failed: ${user.error.message}`);
    }
    return user.data.id;
}

/**
 * Checks for an existing user with the same email or creates a new one if one
 * doesn't exist. Returns User.Id;
 * 
 * @param email User email
 * @param customerName Name to be set for the created User
 * @param client openapi-fetch client
 * @returns User ID
 */
export async function insertUser(email: string, customerName: string, client: CtlxClientType): Promise<string| null> {
    let userId: string | null = null

    // Check if user already exists in Cryptlex Users
    userId = await checkUserExists(email, client);
    if (!userId) {
        try {
            // If user with this email doesn't already exist, create a new one 
            userId = await createUser(email, customerName, client);
        }
        catch (error) {
            userId = await checkUserExists(email, client) // event handlers for two events may both attempt to create the user
            if (!userId) {
                throw error
            }
        }
    }
    return userId
}

/**
 * Updates an existing user with the same email or creates a new one if one
 * doesn't exist. Returns User.Id;
 * 
 * @param email User email
 * @param customerName Name to be set for the created User
 * @param client openapi-fetch client
 * @returns User ID
 */
export async function upsertUser(email: string, customerName: string, client: CtlxClientType): Promise<string| null> {
    // Check if user already exists in Cryptlex Users
    let userId: string | null = null
    userId = await checkUserExists(email, client);
    if (userId) {

        userId = await updateUser(userId, customerName, client);

    } else {
        // If user with this email doesn't already exist, create a new one 
        try {
            userId = await createUser(email, customerName, client)
        }
        catch (error) {
            userId = await checkUserExists(email, client);  // event handlers for two events may both attempt to create the user
            if (userId) {
                userId = await updateUser(userId, customerName, client) // update the user, as the event handler calling this function is given precedence in ensuring the correct username.
            }
            else throw error
        }

    }

    return userId;
}