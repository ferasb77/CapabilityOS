"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/infrastructure/supabase/server";

export async function createWorkshop(formData: FormData) {
  const supabase = await createClient();

  const title = formData.get("title")?.toString() ?? "";
  const description = formData.get("description")?.toString() ?? "";
  const venue = formData.get("venue")?.toString() ?? "";
  const start_date = formData.get("start_date")?.toString() ?? "";
  const end_date = formData.get("end_date")?.toString() ?? "";
  const capacity = Number(formData.get("capacity") ?? 0);

  const { error } = await supabase.from("workshops").insert({
    title,
    description,
    venue,
    start_date,
    end_date,
    capacity,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/workshops");
}