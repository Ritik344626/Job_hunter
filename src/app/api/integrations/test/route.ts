import { NextResponse } from "next/server";
import { z } from "zod";

import { validateApifyApiToken } from "@/lib/services/apify";
import {
  hasValidGeminiApiKeyFormat,
  validateGeminiApiKey,
} from "@/lib/services/gemini";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const testIntegrationSchema = z.object({
  provider: z.enum(["gemini", "apify"]),
  apiKey: z.string().min(10),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = testIntegrationSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  try {
    if (parsedBody.data.provider === "gemini") {
      if (!hasValidGeminiApiKeyFormat(parsedBody.data.apiKey)) {
        return NextResponse.json(
          {
            error:
              "Enter a complete Gemini API key from Google AI Studio.",
          },
          { status: 400 },
        );
      }

      await validateGeminiApiKey(parsedBody.data.apiKey);
      return NextResponse.json({ message: "Gemini connection is working." });
    }

    const username = await validateApifyApiToken(parsedBody.data.apiKey);
    return NextResponse.json({ message: `Connected to Apify as ${username}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    const errorMessage = message.includes("model") || message.includes("not found")
      ? "The Gemini key connected, but the configured model is unavailable. Check GEMINI_MODEL."
      : message.includes("fetch") || message.includes("network") || message.includes("connect")
        ? "JobPilot could not reach Gemini. Check your internet connection and try again."
        : "Gemini could not verify this key. Check that it is active in Google AI Studio and has not been restricted.";

    console.error(
      `Integration test failed for ${parsedBody.data.provider}: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 },
    );
  }
}
