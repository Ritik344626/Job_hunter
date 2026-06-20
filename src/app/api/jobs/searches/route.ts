import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import {
  createJobSearchRun,
  updateJobSearchRun,
} from "@/lib/jobs/repository";
import { getUserIntegrationSecrets } from "@/lib/integrations/repository";
import { startLinkedInScraper } from "@/lib/services/apify";
import { buildLinkedInActorInput } from "@/lib/services/gemini";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const startSearchSchema = z.object({
  query: z.string().min(2),
  roles: z.array(z.string().min(2)).max(10).default([]),
  locations: z.array(z.string().min(2)).max(10).default([]),
  techStack: z.array(z.string().min(1)).max(15).default([]),
  remoteOnly: z.boolean().optional(),
  postedWithin: z.enum(["Any time", "Past 24 hours", "Past 3 days", "Past week", "Past 2 weeks", "Past month"]).default("Any time"),
  experienceLevel: z.enum(["Any experience", "Fresher (0–2 years)", "2–3 years", "3–5 years", "5+ years"]).default("Any experience"),
  maxItems: z.number().int().positive().max(100).default(25),
});

function serializeRun(run: Awaited<ReturnType<typeof createJobSearchRun>>) {
  return {
    id: run.id,
    status: run.status,
    jobsFound: run.jobs_found,
    error: run.error_message,
  };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = startSearchSchema.safeParse(await request.json());

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: parsedBody.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const integration = await getUserIntegrationSecrets(user.id);

  if (!integration?.geminiApiKey || !integration.apifyApiToken) {
    return NextResponse.json(
      { error: "Missing integration keys. Save Gemini and Apify credentials first." },
      { status: 400 },
    );
  }

  const apifyToken = integration.apifyApiToken;

  const searchRun = await createJobSearchRun({
    userId: user.id,
    query: parsedBody.data.query,
    location: parsedBody.data.locations.join(", ") || undefined,
    remoteOnly: parsedBody.data.remoteOnly,
    maxItems: parsedBody.data.maxItems,
    actorId: env.APIFY_LINKEDIN_ACTOR_ID,
  });

  try {
    const actorInput = buildLinkedInActorInput(parsedBody.data);
    console.info("Starting LinkedIn actor", {
      actorId: env.APIFY_LINKEDIN_ACTOR_ID,
      searchRunId: searchRun.id,
      actorInput,
    });
    const apifyRun = await startLinkedInScraper({
      apifyToken,
      actorId: env.APIFY_LINKEDIN_ACTOR_ID,
      actorInput,
    });
    const updatedRun = await updateJobSearchRun(user.id, searchRun.id, {
      status: apifyRun.status === "RUNNING" ? "running" : "queued",
      actor_input: actorInput,
      apify_run_id: apifyRun.runId,
      started_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { ...serializeRun(updatedRun), actorInput },
      { status: 202 },
    );
  } catch (error) {
    const failedRun = await updateJobSearchRun(user.id, searchRun.id, {
      status: "failed",
      error_message: "We could not start this job search.",
      completed_at: new Date().toISOString(),
    });

    console.error(
      `Job search start failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );

    return NextResponse.json(serializeRun(failedRun), { status: 502 });
  }
}
