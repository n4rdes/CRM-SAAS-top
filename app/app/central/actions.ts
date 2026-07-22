"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function markNotificationRead(formData: FormData) {
  const id = String(formData.get("notification_id") ?? "");
  const { supabase, tenant, user } = await requireWorkspace();
  if (id === "all") {
    await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("tenant_id", tenant.id).eq("user_id", user.id).is("read_at", null);
  } else if (UUID_PATTERN.test(id)) {
    await supabase.from("app_notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("tenant_id", tenant.id).eq("user_id", user.id);
  }
  revalidatePath("/app", "layout");
  revalidatePath("/app/central");
  redirect("/app/central");
}
