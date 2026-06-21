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
  filters?: Record<string, any> | null;
};

export async function createJobSearchRun(input: {
  userId: string;
  query: string;
  location?: string;
  remoteOnly?: boolean;
  maxItems: number;
  actorId: string;
  filters?: Record<string, any>;
}) {
  const supabase = await createClient();

  try {
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
        filters: input.filters ?? null,
      })
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at, filters")
      .single<JobSearchRun>();

    if (error && (error.code === "42703" || error.message.includes("filters"))) {
      throw error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch {
    // Fallback: database doesn't have the filters column yet
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
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at")
      .single<JobSearchRun>();

    if (error) {
      throw new Error(`Failed to create search run: ${error.message}`);
    }

    return data;
  }
}

export async function getJobSearchRun(userId: string, runId: string) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("job_search_runs")
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at, filters")
      .eq("id", runId)
      .eq("user_id", userId)
      .maybeSingle<JobSearchRun>();

    if (error && (error.code === "42703" || error.message.includes("filters"))) {
      throw error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch {
    const { data, error } = await supabase
      .from("job_search_runs")
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at")
      .eq("id", runId)
      .eq("user_id", userId)
      .maybeSingle<JobSearchRun>();

    if (error) {
      throw new Error(`Failed to load search run: ${error.message}`);
    }

    return data;
  }
}

export async function updateJobSearchRun(
  userId: string,
  runId: string,
  updates: Partial<Pick<JobSearchRun, "status" | "actor_input" | "apify_run_id" | "dataset_id" | "jobs_found" | "error_message" | "started_at" | "completed_at">>,
) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("job_search_runs")
      .update(updates)
      .eq("id", runId)
      .eq("user_id", userId)
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at, filters")
      .single<JobSearchRun>();

    if (error && (error.code === "42703" || error.message.includes("filters"))) {
      throw error;
    }

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } catch {
    const { data, error } = await supabase
      .from("job_search_runs")
      .update(updates)
      .eq("id", runId)
      .eq("user_id", userId)
      .select("id, user_id, status, query, location, remote_only, max_items, actor_id, actor_input, apify_run_id, dataset_id, jobs_found, error_message, created_at, started_at, completed_at, updated_at")
      .single<JobSearchRun>();

    if (error) {
      throw new Error(`Failed to update search run: ${error.message}`);
    }

    return data;
  }
}

export async function persistSearchJobs(
  userId: string,
  runId: string,
  jobs: (NormalizedJob & { matchScore?: number; matchReason?: string })[],
) {
  if (!jobs.length) {
    return;
  }

  const supabase = await createClient();

  try {
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
        match_score: job.matchScore ?? null,
        match_reason: job.matchReason ?? null,
      })),
      { onConflict: "run_id,external_id" },
    );

    if (error && (error.code === "42703" || error.message.includes("match_score") || error.message.includes("match_reason"))) {
      throw error;
    }

    if (error) {
      throw new Error(error.message);
    }
  } catch {
    // Fallback: prepend score and reason to description if database columns are missing
    const fallbackJobs = jobs.map((job) => {
      let prependedDesc = job.description;
      if (job.matchScore !== undefined || job.matchReason) {
        prependedDesc = `[Match Score: ${job.matchScore ?? 0}%]\n[Reason: ${job.matchReason ?? ""}]\n\n${job.description || ""}`;
      }
      return {
        user_id: userId,
        run_id: runId,
        external_id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        description: prependedDesc,
        date_posted: job.datePosted,
        employment_type: job.employmentType,
        is_remote: job.isRemote,
        salary: job.salary,
        source: job.source,
      };
    });

    const { error } = await supabase.from("job_search_jobs").upsert(
      fallbackJobs,
      { onConflict: "run_id,external_id" },
    );

    if (error) {
      throw new Error(`Failed to store search jobs (fallback): ${error.message}`);
    }
  }
}

export async function listSearchJobs(userId: string, runId: string) {
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
      .from("job_search_jobs")
      .select("external_id, title, company, location, url, description, date_posted, employment_type, is_remote, salary, source, match_score, match_reason")
      .eq("user_id", userId)
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (error && (error.code === "42703" || error.message.includes("match_score"))) {
      throw error;
    }

    if (error) {
      throw new Error(error.message);
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
      matchScore: job.match_score as number | undefined,
      matchReason: job.match_reason as string | undefined,
    })) satisfies (NormalizedJob & { matchScore?: number; matchReason?: string })[];
  } catch {
    const { data, error } = await supabase
      .from("job_search_jobs")
      .select("external_id, title, company, location, url, description, date_posted, employment_type, is_remote, salary, source")
      .eq("user_id", userId)
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to load search jobs (fallback): ${error.message}`);
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
    })) satisfies (NormalizedJob & { matchScore?: number; matchReason?: string })[];
  }
}
