import { Client, Databases, Account, Query, ID } from 'appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('6ab10713000277c1bfca');

export const account = new Account(client);
export const databases = new Databases(client);

export const DB_ID = "6ab109ca0034dbec2965";
export const COL_GROUPS = "groups";
export const COL_MEMBERS = "members";
export const COL_EXPENSES = "expenses";

export { client, Query, ID };

// Realtime sync function matching Android's AppwriteSyncManager
export function subscribeToRealtimeSync(onUpdateCallback) {
  try {
    return client.subscribe(
      [
        `databases.${DB_ID}.collections.${COL_GROUPS}.documents`,
        `databases.${DB_ID}.collections.${COL_MEMBERS}.documents`,
        `databases.${DB_ID}.collections.${COL_EXPENSES}.documents`
      ],
      (response) => {
        // Only fire callback on create, update, or delete events
        if (
          response.events.some(e => e.includes('.create') || e.includes('.update') || e.includes('.delete'))
        ) {
          onUpdateCallback(response);
        }
      }
    );
  } catch (error) {
    console.warn("Realtime subscription failed (project might be paused):", error.message);
    return null;
  }
}
