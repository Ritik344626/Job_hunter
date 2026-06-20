import { createClient } from "@/lib/supabase/server";

export type SavedSearchFilters = {
  roles: string[];
  locations: string[];
  techStack: string[];
  remoteOnly: boolean;
  postedWithin: string;
  experienceLevel: string;
  maxItems: number;
};

export type SavedSearch = {
  id: string;
  name: string;
  filters: SavedSearchFilters;
  created_at: string;
  updated_at: string;
};

export type PipelineStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export type PipelineItem = {
  id: string;
  external_id: string;
  title: string;
  company: string;
  location: string | null;
  url: string | null;
  status: PipelineStatus;
  notes: string | null;
  follow_up_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listSavedSearches(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .select("id, name, filters, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load saved searches: ${error.message}`);
  }

  return (data ?? []) as SavedSearch[];
}

export async function createSavedSearch(
  userId: string,
  name: string,
  filters: SavedSearchFilters,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("saved_searches")
    .insert({ user_id: userId, name, filters })
    .select("id, name, filters, created_at, updated_at")
    .single<SavedSearch>();

  if (error) {
    throw new Error(`Failed to save search: ${error.message}`);
  }

  return data;
}

export async function deleteSavedSearch(userId: string, searchId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("saved_searches")
    .delete()
    .eq("id", searchId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete saved search: ${error.message}`);
  }
}

export async function listPipelineItems(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_pipeline_items")
    .select("id, external_id, title, company, location, url, status, notes, follow_up_at, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load pipeline items: ${error.message}`);
  }

  return (data ?? []) as PipelineItem[];
}

export async function savePipelineItem(
  userId: string,
  job: Pick<PipelineItem, "external_id" | "title" | "company" | "location" | "url">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_pipeline_items")
    .upsert(
      { user_id: userId, ...job },
      { onConflict: "user_id,external_id" },
    )
    .select("id, external_id, title, company, location, url, status, notes, follow_up_at, created_at, updated_at")
    .single<PipelineItem>();

  if (error) {
    throw new Error(`Failed to save pipeline item: ${error.message}`);
  }

  return data;
}

export async function updatePipelineItem(
  userId: string,
  itemId: string,
  updates: Pick<Partial<PipelineItem>, "status" | "notes" | "follow_up_at">,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_pipeline_items")
    .update(updates)
    .eq("id", itemId)
    .eq("user_id", userId)
    .select("id, external_id, title, company, location, url, status, notes, follow_up_at, created_at, updated_at")
    .single<PipelineItem>();

  if (error) {
    throw new Error(`Failed to update pipeline item: ${error.message}`);
  }

  return data;
}
