import type { NormalizedJob } from "@/lib/jobs/normalize";
import { createClient } from "@/lib/supabase/server";

export type SearchRunStatus = "queued" | "running" | "completed" | "failed";

export type JobSearchRun = {
  id: string;
  user_id: string;
  status: SearchRunStatus;
  query: string;
  location: string | null;
  remote_only: boolean;
  max_items: number;
  actor_id: string;
  actor_input: Record<string, unknown> | null;
  apify_run_id: string | null;
  dataset_id: string | null;
  jobs_found: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
};

const runSelect = "id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at";

export async function createJobSearchRun(input: {
  userId: string;
  query: string;
  location?: string;
  remoteOnly?: boolean;
  maxItems: number;
  actorId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_search_runs")
    .insert({
      user_id: input.userId,
      status: "queued",
      query: input.query,
      location: input.location ?? null,
      remote_only: input.remoteOnly ?? false,
      max_items: input.maxItems,
      actor_id: input.actorId,
    })
    .select(runSelect)
    .single<JobSearchRun>();

  if (error) {
    throw new Error(`Failed to create search run: ${error.message}`);
  }

  return data;
}

export async function getJobSearchRun(userId: string, runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_search_runs")
    .select(runSelect)
    .eq("id", runId)
    .eq("user_id", userId)
    .maybeSingle<JobSearchRun>();

  if (error) {
    throw new Error(`Failed to load search run: ${error.message}`);
  }

  return data;
}

export async function updateJobSearchRun(
  userId: string,
  runId: string,
  updates: Partial<Pick<JobSearchRun, "status" | "actor_input" | "apify_run_id" | "dataset_id" | "jobs_found" | "error_message" | "started_at" | "completed_at">>,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_search_runs")
    .update(updates)
    .eq("id", runId)
    .eq("user_id", userId)
    .select(runSelect)
    .single<JobSearchRun>();

  if (error) {
    throw new Error(`Failed to update search run: ${error.message}`);
  }

  return data;
}

export async function persistSearchJobs(
  userId: string,
  runId: string,
  jobs: NormalizedJob[],
) {
  if (!jobs.length) {
    return;
  }

  const supabase = await createClient();
  const { error } = await supabase.from("job_search_jobs").upsert(
    jobs.map((job) => ({
      user_id: userId,
      run_id: runId,
      external_id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      url: job.url,
      description: job.description,
      date_posted: job.datePosted,
      employment_type: job.employmentType,
      is_remote: job.isRemote,
      salary: job.salary,
      source: job.source,
    })),
    { onConflict: "run_id,external_id" },
  );

  if (error) {
    throw new Error(`Failed to store search jobs: ${error.message}`);
  }
}

export async function listSearchJobs(userId: string, runId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_search_jobs")
    .select("external_id, title, company, location, url, description, date_posted, employment_type, is_remote, salary, source")
    .eq("user_id", userId)
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load search jobs: ${error.message}`);
  }

  return (data ?? []).map((job) => ({
    id: job.external_id as string,
    title: job.title as string,
    company: job.company as string,
    location: job.location as string | null,
    url: job.url as string | null,
    description: job.description as string | null,
    datePosted: job.date_posted as string | null,
    employmentType: job.employment_type as string | null,
    isRemote: job.is_remote as boolean,
    salary: job.salary as string | null,
    source: job.source as "linkedin",
  })) satisfies NormalizedJob[];
}
