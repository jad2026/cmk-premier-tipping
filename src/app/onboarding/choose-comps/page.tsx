import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CompPicker from "./CompPicker";
import type { SiteCard } from "./CompPicker";

export const dynamic = "force-dynamic";

type CompRow = {
  id: string;
  slug: string;
  display_name: string | null;
  name: string;
  short_label: string | null;
  logo_url: string | null;
  site_url: string | null;
  accent_color: string | null;
  surface_color: string | null;
};

export default async function ChooseCompsPage({
  searchParams,
}: {
  searchParams: Promise<{ comp?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signup");

  const params = await searchParams;
  const preselectedSlug = params.comp ?? null;

  // Fetch main competitions that have a site_url (i.e., are public-facing)
  const { data: competitions } = (await supabase
    .from("competitions")
    .select(
      "id, slug, display_name, name, short_label, logo_url, site_url, accent_color, surface_color"
    )
    .eq("is_active", true)
    .eq("is_main_comp", true)
    .not("site_url", "is", null)) as unknown as { data: CompRow[] | null };

  const sites: SiteCard[] = (competitions ?? []).map((c) => ({
    id: c.id,
    slug: c.slug,
    display_name: c.display_name ?? c.name,
    name: c.name,
    short_label: c.short_label,
    site_url: c.site_url,
    accent_color: c.accent_color,
    surface_color: c.surface_color,
    // Resolve relative logo URLs by prepending the site_url
    logo_url:
      c.logo_url && c.logo_url.startsWith("/") && c.site_url
        ? `${c.site_url}${c.logo_url}`
        : c.logo_url,
  }));

  return <CompPicker sites={sites} preselectedSlug={preselectedSlug} />;
}
