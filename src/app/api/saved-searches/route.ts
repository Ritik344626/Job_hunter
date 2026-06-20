import { NextResponse } from "next/server";
import { z } from "zod";

import { createSavedSearch, listSavedSearches } from "@/lib/workspace/repository";
import { createClient } from "@/lib/supabase/server";

const filtersSchema = z.object({
  roles: z.array(z.string()).max(10),
  locations: z.array(z.string()).max(10),
  techStack: z.array(z.string()).max(15),
  remoteOnly: z.boolean(),
  postedWithin: z.string(),
  experienceLevel: z.string(),
  maxItems: z.number().int().positive().max(100),
});

const createSavedSearchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  filters: filtersSchema,
});

async function getUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  return { user, error };
}

export async function GET() {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ searches: await listSavedSearches(user.id) });
}

export async function POST(request: Request) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = createSavedSearchSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid saved search" },
      { status: 400 },
    );
  }

  const search = await createSavedSearch(user.id, body.data.name, body.data.filters);
  return NextResponse.json({ search }, { status: 201 });
}
