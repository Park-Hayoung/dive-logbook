import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/services/supabase";

export type Shop = {
  id: string;
  name: string;
  country: string;
  city: string;
  region: string;
  rating: number;
  reviewCount: number;
  description: string | null;
  imageUrl: string | null;
  isPremium: boolean;
};

type ShopRow = {
  id: string;
  name: string;
  country: string;
  city: string;
  region: string;
  rating: number | string | null;
  review_count: number | null;
  description: string | null;
  image_url: string | null;
  is_premium: boolean;
};

const mapShop = (r: ShopRow): Shop => ({
  id: r.id,
  name: r.name,
  country: r.country,
  city: r.city,
  region: r.region,
  rating: typeof r.rating === "string" ? Number(r.rating) : (r.rating ?? 0),
  reviewCount: r.review_count ?? 0,
  description: r.description,
  imageUrl: r.image_url,
  isPremium: r.is_premium,
});

export type ShopFilters = {
  country?: string;
  city?: string;
  region?: string;
};

export function useShops(filters: ShopFilters) {
  return useQuery({
    queryKey: ["shops", filters],
    queryFn: async (): Promise<Shop[]> => {
      let q = supabase
        .from("shops")
        .select(
          "id,name,country,city,region,rating,review_count,description,image_url,is_premium",
        )
        .order("is_premium", { ascending: false })
        .order("rating", { ascending: false });

      if (filters.country) q = q.eq("country", filters.country);
      if (filters.city) q = q.eq("city", filters.city);
      if (filters.region) q = q.eq("region", filters.region);

      const { data, error } = await q;
      if (error) throw error;
      return ((data ?? []) as unknown as ShopRow[]).map(mapShop);
    },
  });
}

export function useShop(shopId: string | undefined) {
  return useQuery({
    queryKey: ["shop", shopId],
    enabled: !!shopId,
    queryFn: async (): Promise<Shop | null> => {
      const { data, error } = await supabase
        .from("shops")
        .select(
          "id,name,country,city,region,rating,review_count,description,image_url,is_premium",
        )
        .eq("id", shopId!)
        .maybeSingle();
      if (error) throw error;
      return data ? mapShop(data as unknown as ShopRow) : null;
    },
  });
}

// Distinct location values for cascading dropdowns. We pull all unique values
// in a single query and de-dup client-side (cheap until shops table is huge).
export function useShopLocations() {
  return useQuery({
    queryKey: ["shop-locations"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("country,city,region");
      if (error) throw error;
      const rows = (data ?? []) as unknown as {
        country: string;
        city: string;
        region: string;
      }[];

      const countries = new Set<string>();
      const citiesByCountry = new Map<string, Set<string>>();
      const regionsByCity = new Map<string, Set<string>>();

      for (const r of rows) {
        countries.add(r.country);
        const cKey = r.country;
        if (!citiesByCountry.has(cKey)) citiesByCountry.set(cKey, new Set());
        citiesByCountry.get(cKey)!.add(r.city);
        const rKey = `${r.country}/${r.city}`;
        if (!regionsByCity.has(rKey)) regionsByCity.set(rKey, new Set());
        regionsByCity.get(rKey)!.add(r.region);
      }

      return {
        countries: Array.from(countries).sort(),
        citiesByCountry: Object.fromEntries(
          Array.from(citiesByCountry.entries()).map(([k, v]) => [
            k,
            Array.from(v).sort(),
          ]),
        ),
        regionsByCity: Object.fromEntries(
          Array.from(regionsByCity.entries()).map(([k, v]) => [
            k,
            Array.from(v).sort(),
          ]),
        ),
      };
    },
  });
}
