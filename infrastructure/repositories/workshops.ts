import { createClient } from "@/infrastructure/supabase/server";

export type Workshop = {
  id: string;
  title: string;
  description: string | null;
  venue: string | null;
  start_date: string;
  end_date: string;
  capacity: number;
  created_at: string;
};

export async function getWorkshops(): Promise<Workshop[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workshops")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}