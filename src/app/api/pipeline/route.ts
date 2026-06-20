import { NextResponse } from "next/server";
import { z } from "zod";

import { listPipelineItems, savePipelineItem } from "@/lib/workspace/repository";
import { createClient } from "@/lib/supabase/server";

const savePipelineItemSchema = z.object({
  externalId: z.string().min(1),
  title: z.string().min(1),
  company: z.string().min(1),
  location: z.string().nullable(),
  url: z.string().url().nullable(),
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

  return NextResponse.json({ items: await listPipelineItems(user.id) });
}

export async function POST(request: Request) {
  const { user, error } = await getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = savePipelineItemSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid job" },
      { status: 400 },
    );
  }

  const item = await savePipelineItem(user.id, {
    external_id: body.data.externalId,
    title: body.data.title,
    company: body.data.company,
    location: body.data.location,
    url: body.data.url,
  });

  return NextResponse.json({ item }, { status: 201 });
}
