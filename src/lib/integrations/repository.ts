import { createClient } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

export type UserIntegration = {
    user_id: string;
    gemini_api_key_encrypted: string | null;
    apify_api_token_encrypted: string | null;
    created_at: string;
    updated_at: string;
};

export async function getUserIntegration(userId: string) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("user_integrations")
        .select(
            "user_id, gemini_api_key_encrypted, apify_api_token_encrypted, created_at, updated_at",
        )
        .eq("user_id", userId)
        .maybeSingle<UserIntegration>();

    if (error) {
        throw new Error(`Failed to load user integrations: ${error.message}`);
    }

    return data;
}

export async function getUserIntegrationSecrets(userId: string) {
    const integration = await getUserIntegration(userId);

    if (!integration) {
        return null;
    }

    return {
        geminiApiKey: integration.gemini_api_key_encrypted
            ? decryptSecret(integration.gemini_api_key_encrypted)
            : null,
        apifyApiToken: integration.apify_api_token_encrypted
            ? decryptSecret(integration.apify_api_token_encrypted)
            : null,
    };
}

export async function upsertUserIntegration(
    userId: string,
    updates: { geminiApiKey?: string; apifyApiToken?: string },
) {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("user_integrations")
        .upsert(
            {
                user_id: userId,
                ...(updates.geminiApiKey !== undefined
                    ? { gemini_api_key_encrypted: encryptSecret(updates.geminiApiKey) }
                    : {}),
                ...(updates.apifyApiToken !== undefined
                    ? { apify_api_token_encrypted: encryptSecret(updates.apifyApiToken) }
                    : {}),
            },
            {
                onConflict: "user_id",
            },
        )
        .select(
            "user_id, gemini_api_key_encrypted, apify_api_token_encrypted, created_at, updated_at",
        )
        .single<UserIntegration>();

    if (error) {
        throw new Error(`Failed to save user integrations: ${error.message}`);
    }

    return data;
}
