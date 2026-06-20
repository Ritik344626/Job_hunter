import { NextResponse } from "next/server";

import { deleteSavedSearch } from "@/lib/workspace/repository";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteSavedSearch(user.id, searchId);
  return NextResponse.json({ message: "Saved search deleted." });
}
