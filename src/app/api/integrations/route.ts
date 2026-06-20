import { NextResponse } from "next/server";
import { z } from "zod";

import {
    getUserIntegration,
    upsertUserIntegration,
} from "@/lib/integrations/repository";
import { validateApifyApiToken } from "@/lib/services/apify";
import {
  hasValidGeminiApiKeyFormat,
  validateGeminiApiKey,
} from "@/lib/services/gemini";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const updateIntegrationsSchema = z
    .object({
        geminiApiKey: z.string().min(10).optional(),
        apifyApiToken: z.string().min(10).optional(),
    })
    .refine(
        (value) =>
            value.geminiApiKey !== undefined || value.apifyApiToken !== undefined,
        {
            message: "At least one key is required.",
        },
    );

async function validateIntegrationUpdates(updates: z.infer<typeof updateIntegrationsSchema>) {
    const validations = [];

  if (updates.geminiApiKey) {
    if (!hasValidGeminiApiKeyFormat(updates.geminiApiKey)) {
      throw new Error("INVALID_GEMINI_KEY_FORMAT");
    }

        validations.push(validateGeminiApiKey(updates.geminiApiKey));
    }

    if (updates.apifyApiToken) {
        validations.push(validateApifyApiToken(updates.apifyApiToken));
    }

    await Promise.all(validations);
}

function getSafeErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error.message.startsWith("Integration encryption")) {
    return error.message;
  }

  if (error.message === "INVALID_GEMINI_KEY_FORMAT") {
    return "Enter a complete Gemini API key from Google AI Studio. It should begin with AIza.";
  }

  return fallback;
}

export async function GET() {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await getUserIntegration(user.id);

    return NextResponse.json({
        hasGeminiKey: Boolean(integration?.gemini_api_key_encrypted),
        hasApifyToken: Boolean(integration?.apify_api_token_encrypted),
        updatedAt: integration?.updated_at ?? null,
    });
}

export async function POST(request: Request) {
    const supabase = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsedBody = updateIntegrationsSchema.safeParse(rawBody);

    if (!parsedBody.success) {
        return NextResponse.json(
            { error: parsedBody.error.issues[0]?.message ?? "Invalid payload" },
            { status: 400 },
        );
    }

    try {
        await validateIntegrationUpdates(parsedBody.data);
        const updated = await upsertUserIntegration(user.id, parsedBody.data);

        return NextResponse.json({
            message: "Integrations saved.",
            hasGeminiKey: Boolean(updated.gemini_api_key_encrypted),
            hasApifyToken: Boolean(updated.apify_api_token_encrypted),
            updatedAt: updated.updated_at,
        });
    } catch (error) {
        return NextResponse.json(
            { error: getSafeErrorMessage(error, "We could not validate those credentials.") },
            { status: 400 },
        );
    }
}
