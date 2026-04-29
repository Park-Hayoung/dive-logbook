// 1회성 시드 도구: 퐁당닷컴 스쿠버 카테고리에서 브랜드 리스트 추출.
// 각 카테고리 페이지가 server-rendered HTML 로 브랜드 필터를 노출 →
// 그 부분만 파싱. 상품 카드는 AJAX 로드라 여기선 다루지 않음 (UGC 로 자연 성장).
//
// 출력: ./seed.sql  (supabase SQL editor 에 붙여넣어 실행)
// 실행: npm install && npm run seed
//
// 법적/윤리: 브랜드명은 사실 정보(공개 사실) → 저작권 보호 대상 아님. 1회성 + 비상업적
// 시드 + 우리 앱 카탈로그 자체 운영 목적. 런타임에 퐁당을 호출하지 않음.

import { writeFileSync } from "node:fs";
import { load } from "cheerio";

// ─────────────────────────────────────────────────────────────────────────────
// 우리 앱 내부 카테고리 enum 으로 정규화
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = {
  MASK: { code: "00020030", label: "마스크" },
  SNORKEL: { code: "00020032", label: "스노클" },
  FIN: { code: "00020026", label: "오리발" },
  BOOTS: { code: "00020029", label: "부츠" },
  GLOVES: { code: "00020028", label: "장갑" },
  HOOD: { code: "00020033", label: "후드" },
  WETSUIT: { code: "00020034", label: "웨트슈트" },
  DRYSUIT: { code: "00020035", label: "드라이슈트" },
  WEIGHT: { code: "00020027", label: "웨이트" },
  REGULATOR: { code: "00020004", label: "호흡기" },
  COMPUTER: { code: "00020005", label: "다이브 컴퓨터" },
  GAUGE: { code: "00020009", label: "게이지" },
  BCD: { code: "00020002", label: "BCD" },
  BACKPLATE: { code: "00020024", label: "백플레이트" },
  LIGHT: { code: "00020020", label: "라이트" },
  KNIFE: { code: "00020010", label: "나이프" },
  TANK: { code: "00020001", label: "공기통" },
} as const;

type CategoryKey = keyof typeof CATEGORIES;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// 서버에서 알아본 패턴: 브랜드 필터는 .brandList li label 에 노이즈 없이 들어있음.
// data-searchname="brand_NNNN" 가 있고, 텍스트 노드가 한국어 브랜드명.
async function fetchBrands(categoryCode: string): Promise<string[]> {
  const url = `https://www.pongdang.com/goods/catalog?code=${categoryCode}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const html = await res.text();
  const $ = load(html);

  const brands = new Set<string>();
  $(".brandList li label").each((_, el) => {
    // label 안에 input 과 텍스트가 섞여있음. 텍스트 노드만 모아서 trim.
    const text = $(el)
      .contents()
      .filter((_, n) => n.type === "text")
      .map((_, n) => $(n).text().trim())
      .get()
      .filter(Boolean)
      .join(" ")
      .trim();
    if (text) brands.add(text);
  });
  return [...brands];
}

function escapeSqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}

async function main() {
  const allRows: { brand: string; category: CategoryKey }[] = [];
  const errors: string[] = [];

  for (const [key, meta] of Object.entries(CATEGORIES) as [
    CategoryKey,
    (typeof CATEGORIES)[CategoryKey],
  ][]) {
    process.stdout.write(`[${key.padEnd(11)}] ${meta.label}... `);
    try {
      const brands = await fetchBrands(meta.code);
      console.log(`${brands.length} brands`);
      for (const b of brands) {
        allRows.push({ brand: b, category: key });
      }
      // 서버 부담 줄이려고 카테고리 사이 잠깐 쉼.
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`FAIL — ${msg}`);
      errors.push(`${key}: ${msg}`);
    }
  }

  // 동일 브랜드가 여러 카테고리에 등장 가능 → 행 단위로 모두 INSERT (UNIQUE name+category).
  const lines: string[] = [
    "-- equipment_brands 시드 데이터 (퐁당닷컴 1회성 추출, 브랜드명만 사실 정보).",
    "-- 적용: supabase SQL editor에 그대로 붙여넣기. 006 마이그레이션 이후 실행.",
    "",
    "begin;",
    "",
    "insert into public.equipment_brands (name, category, source) values",
  ];
  const valueRows = allRows.map(
    (r) => `  ('${escapeSqlLiteral(r.brand)}', '${r.category}', 'pongdang_seed')`,
  );
  lines.push(valueRows.join(",\n") + "\non conflict (name, category) do nothing;");
  lines.push("");
  lines.push("commit;");

  const out = lines.join("\n") + "\n";
  writeFileSync("./seed.sql", out, "utf8");

  console.log("");
  console.log(`총 ${allRows.length} 행 → seed.sql 작성 완료`);
  console.log(
    `유니크 브랜드: ${new Set(allRows.map((r) => r.brand)).size}`,
  );
  if (errors.length) {
    console.log("실패한 카테고리:");
    for (const e of errors) console.log(`  - ${e}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
