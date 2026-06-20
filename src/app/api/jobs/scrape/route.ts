import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { normalizeLinkedInJobs } from "@/lib/jobs/normalize";
import { getUserIntegrationSecrets } from "@/lib/integrations/repository";
import { runLinkedInScraper } from "@/lib/services/apify";
import { buildLinkedInActorInput } from "@/lib/services/gemini";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const scrapeRequestSchema = z.object({
    query: z.string().min(2),
    location: z.string().optional(),
    remoteOnly: z.boolean().optional(),
    maxItems: z.number().int().positive().max(100).default(25),
});

function getScrapeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (message.includes("input is not valid") || message.includes("invalid-input")) {
    return "The LinkedIn scraper rejected the generated search. Please adjust your role or location and try again.";
  }

  if (message.includes("insufficient") || message.includes("payment") || message.includes("credit")) {
    return "Your Apify account does not have enough credits to run this search.";
  }

  return "The job search could not be completed. Please try again in a moment.";
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
    const parsedBody = scrapeRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
        return NextResponse.json(
            { error: parsedBody.error.issues[0]?.message ?? "Invalid payload" },
            { status: 400 },
        );
    }

    let integration;

    try {
        integration = await getUserIntegrationSecrets(user.id);
    } catch {
        return NextResponse.json(
            { error: "Your saved credentials could not be read. Reconnect your integrations." },
            { status: 400 },
        );
    }

    if (!integration?.geminiApiKey || !integration.apifyApiToken) {
        return NextResponse.json(
            {
                error:
                    "Missing integration keys. Save Gemini and Apify credentials first.",
            },
            { status: 400 },
        );
    }

  try {
    const actorInput = buildLinkedInActorInput(parsedBody.data);
    console.info("Starting LinkedIn actor", {
      actorId: env.APIFY_LINKEDIN_ACTOR_ID,
      actorInput,
    });
    const result = await runLinkedInScraper({
      apifyToken: integration.apifyApiToken,
      actorId: env.APIFY_LINKEDIN_ACTOR_ID,
      actorInput,
    });
    const jobs = normalizeLinkedInJobs(result.items);

    return NextResponse.json({
      actorId: env.APIFY_LINKEDIN_ACTOR_ID,
      actorInput,
      runId: result.runId,
      datasetId: result.datasetId,
      jobsFound: jobs.length,
      items: jobs,
    });
  } catch (error) {
    console.error(
      `Job scrape failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    return NextResponse.json(
      { error: getScrapeErrorMessage(error) },
      { status: 502 },
    );
  }
}
