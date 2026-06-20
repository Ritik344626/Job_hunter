import { NextResponse } from "next/server";

import { getUserIntegrationSecrets } from "@/lib/integrations/repository";
import { normalizeLinkedInJobs } from "@/lib/jobs/normalize";
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
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const failedApifyStatuses = new Set(["FAILED", "ABORTED", "TIMED-OUT"]);

function serializeRun(run: Awaited<ReturnType<typeof getJobSearchRun>>, jobs = [] as Awaited<ReturnType<typeof listSearchJobs>>) {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    status: run.status,
    jobsFound: run.jobs_found,
    error: run.error_message,
    items: jobs,
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
    return NextResponse.json(serializeRun(searchRun, jobs));
  }

  if (!searchRun.apify_run_id) {
    return NextResponse.json({ error: "Search run is still being prepared" }, { status: 409 });
  }

  const integration = await getUserIntegrationSecrets(user.id);

  if (!integration?.apifyApiToken) {
    return NextResponse.json(
      { error: "Reconnect Apify to check this search run." },
      { status: 400 },
    );
  }

  const apifyToken = integration.apifyApiToken;

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
      const jobs = normalizeLinkedInJobs(items);
      await persistSearchJobs(user.id, searchRun.id, jobs);
      const completedRun = await updateJobSearchRun(user.id, searchRun.id, {
        status: "completed",
        dataset_id: apifyRun.defaultDatasetId,
        jobs_found: jobs.length,
        completed_at: new Date().toISOString(),
      });

      return NextResponse.json(serializeRun(completedRun, jobs));
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
