import { NextResponse } from "next/server";

import { getUserIntegrationSecrets } from "@/lib/integrations/repository";
import { normalizeLinkedInJobs } from "@/lib/jobs/normalize";
import { scoreJobAgainstFilters } from "@/lib/jobs/match";
import {
  getJobSearchRun,
  listSearchJobs,
  persistSearchJobs,
  updateJobSearchRun,
} from "@/lib/jobs/repository";
import {
  getLinkedInScraperDatasetItems,
  getLinkedInScraperRun,
} from "@/lib/services/apify";
import { evaluateJobsWithGemini } from "@/lib/services/gemini";
import type { BuildActorInputArgs } from "@/lib/services/gemini";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const failedApifyStatuses = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

// In-memory set to lock concurrent Gemini evaluations for active runs
const activeScreenings = new Set<string>();

function serializeRun(
  run: Awaited<ReturnType<typeof getJobSearchRun>>,
  jobs = [] as Awaited<ReturnType<typeof listSearchJobs>>,
  isScreening = false
) {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    jobsFound: run.jobs_found,
    error: run.error_message,
    items: jobs,
    isScreening,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchRun = await getJobSearchRun(user.id, runId);

  if (!searchRun) {
    return NextResponse.json({ error: "Search run not found" }, { status: 404 });
  }

  if (searchRun.status === "completed" || searchRun.status === "failed") {
    const jobs = searchRun.status === "completed"
      ? await listSearchJobs(user.id, searchRun.id)
      : [];
    return NextResponse.json(serializeRun(searchRun, jobs, false));
  }

  // If another polling thread is already screening the dataset with Gemini,
  // immediately return the run in its current database state and mark it as screening.
  if (activeScreenings.has(runId)) {
    const jobs = await listSearchJobs(user.id, searchRun.id);
    return NextResponse.json(serializeRun(searchRun, jobs, true));
  }

  if (!searchRun.apify_run_id) {
    return NextResponse.json({ error: "Search run is still being prepared" }, { status: 409 });
  }

  const integration = await getUserIntegrationSecrets(user.id);

  if (!integration?.apifyApiToken || !integration?.geminiApiKey) {
    return NextResponse.json(
      { error: "Reconnect your integrations (Apify and Gemini) to check this search run." },
      { status: 400 },
    );
  }

  const apifyToken = integration.apifyApiToken;
  const geminiApiKey = integration.geminiApiKey;

  try {
    const apifyRun = await getLinkedInScraperRun(apifyToken, searchRun.apify_run_id);

    if (!apifyRun) {
      throw new Error("Apify run could not be found.");
    }

    if (apifyRun.status === "SUCCEEDED") {
      if (!apifyRun.defaultDatasetId) {
        throw new Error("Apify run completed without a dataset.");
      }

      const items = await getLinkedInScraperDatasetItems(apifyToken, apifyRun.defaultDatasetId);
      const rawJobs = normalizeLinkedInJobs(items);
      const filters: BuildActorInputArgs = (searchRun.filters as BuildActorInputArgs | null) ?? {
        query: searchRun.query,
        roles: searchRun.query.split(" OR "),
        locations: searchRun.location ? [searchRun.location] : [],
        remoteOnly: searchRun.remote_only,
        maxItems: searchRun.max_items,
      };

      if (!env.GEMINI_JOB_SCREENING_ENABLED) {
        const scoredJobs = rawJobs
          .map((job) => ({ ...job, ...scoreJobAgainstFilters(job, filters) }))
          .sort((firstJob, secondJob) => secondJob.matchScore - firstJob.matchScore);
        await persistSearchJobs(user.id, searchRun.id, scoredJobs);
        const completedRun = await updateJobSearchRun(user.id, searchRun.id, {
          status: "completed",
          dataset_id: apifyRun.defaultDatasetId,
          jobs_found: scoredJobs.length,
          completed_at: new Date().toISOString(),
        });

        return NextResponse.json(serializeRun(completedRun, scoredJobs, false));
      }

      activeScreenings.add(searchRun.id);

      try {
        const evaluations = await evaluateJobsWithGemini(geminiApiKey, rawJobs, filters);
        const evaluationMap = new Map(evaluations.map((ev) => [ev.id, ev]));

        const screenedJobs = rawJobs
          .map((job) => {
            const evalResult = evaluationMap.get(job.id);
            return {
              ...job,
              match: evalResult ? evalResult.match : true,
              matchScore: evalResult ? evalResult.score : 75,
            };
          })
          .sort((firstJob, secondJob) => secondJob.matchScore - firstJob.matchScore);

        await persistSearchJobs(user.id, searchRun.id, screenedJobs);

        const completedRun = await updateJobSearchRun(user.id, searchRun.id, {
          status: "completed",
          dataset_id: apifyRun.defaultDatasetId,
          jobs_found: screenedJobs.length,
          completed_at: new Date().toISOString(),
        });

        activeScreenings.delete(searchRun.id);
        return NextResponse.json(serializeRun(completedRun, screenedJobs, false));
      } catch (screenError) {
        console.error("Failed during AI job screening and persistence:", screenError);
        const failedRun = await updateJobSearchRun(user.id, searchRun.id, {
          status: "failed",
          error_message: screenError instanceof Error
            ? screenError.message
            : "Failed during AI screening",
          completed_at: new Date().toISOString(),
        });
        activeScreenings.delete(searchRun.id);
        return NextResponse.json(serializeRun(failedRun, [], false));
      }
    }

    if (failedApifyStatuses.has(apifyRun.status)) {
      const failedRun = await updateJobSearchRun(user.id, searchRun.id, {
        status: "failed",
        error_message: "Apify could not complete this search. Please try again.",
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json(serializeRun(failedRun));
    }

    const runningRun = await updateJobSearchRun(user.id, searchRun.id, {
      status: "running",
    });

    return NextResponse.json(serializeRun(runningRun));
  } catch (error) {
    activeScreenings.delete(searchRun.id);
    console.error(
      `Job search poll failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    const failedRun = await updateJobSearchRun(user.id, searchRun.id, {
      status: "failed",
      error_message: "We could not check this search run. Please try again.",
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(serializeRun(failedRun));
  }
}
