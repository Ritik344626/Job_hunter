import { NextResponse } from "next/server";
import { z } from "zod";

import { updatePipelineItem } from "@/lib/workspace/repository";
import { createClient } from "@/lib/supabase/server";

const updatePipelineItemSchema = z.object({
  status: z.enum(["saved", "applied", "interviewing", "offer", "rejected"]).optional(),
  notes: z.string().max(3000).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const { itemId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = updatePipelineItemSchema.safeParse(await request.json());

  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid pipeline update" },
      { status: 400 },
    );
  }

  const item = await updatePipelineItem(user.id, itemId, {
    ...(body.data.status ? { status: body.data.status } : {}),
    ...(body.data.notes !== undefined ? { notes: body.data.notes } : {}),
    ...(body.data.followUpAt !== undefined ? { follow_up_at: body.data.followUpAt } : {}),
  });

  return NextResponse.json({ item });
}
