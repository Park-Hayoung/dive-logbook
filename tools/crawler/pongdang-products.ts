// 1회성 시드 도구: 퐁당닷컴 스쿠버 카테고리에서 실 상품명 풀 크롤.
//
// 구조 분석 결과 (Playwright MCP 인스펙트):
//   - 메인 그리드 컨테이너: #searchedItemDisplay
//   - 각 상품 li:        .goods_list_style1
//   - 브랜드명:           .goods_name_area .brand_name       (별도 분리되어 있음)
//   - 상품명:             .goods_name_area .name
//   - 추천상품 영역(.gl_item / .designCategoryRecommendDisplay) 은 별도 — 무시
//   - URL:               /goods/catalog?code=XXXX&page=N&per=40&searchMode=catalog
//
// 출력: ./seed-products.sql  (Supabase SQL editor에 그대로 붙여넣어 실행)
// 실행:
//   npm install
//   npx playwright install chromium    (최초 1회)
//   npm run seed:products
//
// 법적/윤리: 상품명/브랜드명은 사실 정보. 1회성 + 비상업적 시드.

import { writeFileSync } from "node:fs";
import { chromium, type Page } from "playwright";

// ─────────────────────────────────────────────────────────────────────────────
// 카테고리 매핑
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

// ─────────────────────────────────────────────────────────────────────────────
// 한글 → 영문 브랜드 매핑 (007 마이그레이션과 동기화)
// ─────────────────────────────────────────────────────────────────────────────
const BRAND_KO_TO_EN: Record<string, string> = {
  스쿠버프로: "Scubapro",
  마레스: "Mares",
  크레씨: "Cressi",
  아쿠아룽: "Aqualung",
  에이펙스: "Apeks",
  아토믹: "Atomic Aquatics",
  투사: "Tusa",
  투사스포츠: "Tusa Sports",
  순토: "Suunto",
  가민: "Garmin",
  시어워터: "Shearwater",
  홀리스: "Hollis",
  오셔닉: "Oceanic",
  시악: "Seac",
  바레: "Bare",
  워터프루프: "Waterproof",
  뷰샤: "Beuchat",
  뷰샤트: "Beuchat",
  뷰: "View",
  제네시스: "Genesis",
  리더핀: "Leaderfins",
  하이랜드: "Highland",
  산티: "Santi",
  아이켈라이트: "Ikelite",
  "기어에이드(맥넷)": "Gear Aid",
  맥넷: "McNett",
  아르곤: "Argon",
  다이브텍: "DiveTec",
  오션리프: "Ocean Reef",
  다이브라이트: "Dive Rite",
  할시온: "Halcyon",
  엑스딥: "XDeep",
  테크라인: "Tecline",
  셔우드: "Sherwood",
  지글: "Zeagle",
  빅블루: "Bigblue",
  라이트앤모션: "Light & Motion",
  서브기어: "Subgear",
  오엠에스: "OMS",
  살비마르: "Salvimar",
  오메르: "Omer",
  마코: "Mako",
  프로블루: "Problue",
  아코나: "Akona",
  핸더슨: "Henderson",
  피나클: "Pinnacle",
  포스엘리먼트: "Fourth Element",
  아쿠아스피어: "Aqua Sphere",
  아폴로: "Apollo",
  걸: "Gull",
};

// ─────────────────────────────────────────────────────────────────────────────
// 모델명 정리 — 마케팅 prefix / 판매 메타 텍스트 제거
// ─────────────────────────────────────────────────────────────────────────────
// 1) prefix 정리:
//    "[재입고 미정] 갈릴레오 HUD"           → "갈릴레오 HUD"
//    "★특별 세일★ MK25 EVO"                  → "MK25 EVO"
//    "★스쿠버프로 이벤트★ ★옥토증정★ XR3"   → "XR3"
//
// 2) 판매 메타 괄호 정리 (모델명 중간/끝):
//    "로버 수트 5mm (렌탈용 장비, 2개 이상 구매 가능)" → "" (렌탈은 row 통째 skip)
//    "퍽 라이트 (개별 구매)"                   → "퍽 라이트"
//    "마스크 (단품)"                            → "마스크"
//    "(D타입)" / "(GP-7028)" / "(40cf, 80cf)"  → 보존 (정상 spec)
//
// 규칙:
//   - 빈 문자열 반환은 "렌탈 행" 시그널 — 메인 코드에서 skip
const PREFIX_PATTERN = /^\s*(?:\[[^\]]*\]|★[^★]*★|☆[^☆]*☆|⭐[^⭐]*⭐)\s*/u;

// 렌탈 키워드 — model에 "렌탈"이 들어있으면 row 자체를 제외.
const RENTAL_PATTERN = /렌탈/u;

// 괄호 안에 있을 때만 제거할 판매 메타 키워드. 정상 spec 괄호("(D타입)" 등) 는 보존.
const SALES_META_KEYWORDS = [
  "개별\\s*구매",
  "개\\s*이상",      // "2개 이상 구매 가능"
  "구매\\s*가능",
  "단품",
  "풀\\s*세트",
  "풀\\s*셋",
  "특가",
  "할인",
  "이벤트",
  "증정",
  "NEW",
  "신상",
  "예약\\s*판매",
  "재고\\s*소진",
  "재입고",
];
const SALES_META_PAREN = new RegExp(
  `\\s*\\([^)]*(?:${SALES_META_KEYWORDS.join("|")})[^)]*\\)`,
  "giu",
);

export function cleanModel(raw: string): string {
  if (RENTAL_PATTERN.test(raw)) return ""; // 렌탈 행 → 메인에서 skip

  let s = raw;
  // 1) prefix 반복 제거
  for (let i = 0; i < 6; i++) {
    const next = s.replace(PREFIX_PATTERN, "");
    if (next === s) break;
    s = next;
  }
  // 2) 판매 메타 괄호 제거 (모델명 어디든)
  s = s.replace(SALES_META_PAREN, "");
  // 공백 정리
  s = s.replace(/\s+/g, " ").trim();
  return s || raw.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// 페이지 추출
// ─────────────────────────────────────────────────────────────────────────────
type RawItem = { brand: string; model: string; href: string };

async function extractPage(page: Page): Promise<RawItem[]> {
  const tryOnce = async (): Promise<RawItem[]> => {
    try {
      await page.waitForSelector("#searchedItemDisplay .goods_list_style1", {
        timeout: 12000,
      });
    } catch {
      return [];
    }
    // lazy 텍스트 채움 여유.
    await page.waitForTimeout(300);

    return await page.$$eval(
      "#searchedItemDisplay .goods_list_style1",
      (els) =>
        els
          .map((li) => {
            const brand =
              li.querySelector(".goods_name_area .brand_name")?.textContent?.trim() ??
              "";
            const nameEl = li.querySelector(".goods_name_area .name");
            const model = (nameEl?.textContent ?? "").trim();
            const a = li.querySelector(
              '.goods_name_area a[href*="/goods/view"]',
            ) as HTMLAnchorElement | null;
            const href = a?.getAttribute("href") ?? "";
            return { brand, model, href };
          })
          .filter((x) => x.model && x.href),
    );
  };

  // 첫 시도에서 빈 결과면 reload 후 1회 재시도 (일시적 AJAX 타이밍 이슈 방어).
  // 진짜 빈 페이지(끝 페이지)도 다시 빈 결과 — 그럼 자연스럽게 종료됨.
  let items = await tryOnce();
  if (items.length === 0) {
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    } catch {
      /* reload 실패해도 일단 다시 추출 시도 */
    }
    items = await tryOnce();
  }
  return items;
}

async function fetchAllForCategory(
  page: Page,
  code: string,
  label: string,
): Promise<RawItem[]> {
  const seen = new Map<string, RawItem>();
  const MAX_PAGES = 30; // per=40 × 30 = 1200 / 카테고리. 실 데이터 충분.

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const url =
      `https://www.pongdang.com/goods/catalog` +
      `?code=${code}&page=${pageNum}&per=40&searchMode=catalog&sorting=sale`;

    process.stdout.write(`  ${label} p${pageNum}... `);
    let items: RawItem[];
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      items = await extractPage(page);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`fetch fail: ${msg}`);
      break;
    }

    let newCount = 0;
    for (const it of items) {
      if (!seen.has(it.href)) {
        seen.set(it.href, it);
        newCount += 1;
      }
    }
    console.log(`${items.length} items (+${newCount} new, total ${seen.size})`);

    // 빈 페이지 → 페이지 끝. 새 항목 0 → 무한루프 방지로 종료.
    if (items.length === 0 || newCount === 0) break;
    // per=40 미만이면 마지막 페이지.
    if (items.length < 40) break;
  }

  return [...seen.values()];
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL 출력
// ─────────────────────────────────────────────────────────────────────────────
const escapeSql = (s: string) => s.replace(/'/g, "''");

type SeedRow = {
  brand: string | null;
  brand_en: string | null;
  model: string;
  category: CategoryKey;
};

function toSql(rows: SeedRow[]): string {
  const lines: string[] = [
    "-- equipment 카탈로그 시드 (퐁당닷컴 1회성 풀 크롤).",
    "-- 적용: Supabase SQL Editor 에서 실행. 006/007 마이그레이션 이후.",
    "",
    "begin;",
    "",
    "insert into public.equipment (brand, brand_en, model, category, source) values",
  ];
  const valueRows = rows.map((r) => {
    const brand = r.brand ? `'${escapeSql(r.brand)}'` : "null";
    const brandEn = r.brand_en ? `'${escapeSql(r.brand_en)}'` : "null";
    const model = `'${escapeSql(r.model)}'`;
    return `  (${brand}, ${brandEn}, ${model}, '${r.category}', 'pongdang_seed')`;
  });
  lines.push(valueRows.join(",\n") + "\non conflict (brand, model) do nothing;");
  lines.push("");
  lines.push("commit;");
  return lines.join("\n") + "\n";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("Launching headless Chromium...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  });
  const page = await context.newPage();

  const allRows: SeedRow[] = [];
  const errors: string[] = [];

  for (const [key, meta] of Object.entries(CATEGORIES) as [
    CategoryKey,
    (typeof CATEGORIES)[CategoryKey],
  ][]) {
    console.log(`\n[${key}] ${meta.label} (code=${meta.code})`);
    try {
      const items = await fetchAllForCategory(page, meta.code, key);
      for (const it of items) {
        const cleanedModel = cleanModel(it.model);
        if (!cleanedModel) continue;
        const brand = it.brand || null;
        const brand_en = brand ? BRAND_KO_TO_EN[brand] ?? null : null;
        allRows.push({
          brand,
          brand_en,
          model: cleanedModel,
          category: key,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  FAIL — ${msg}`);
      errors.push(`${key}: ${msg}`);
    }
  }

  await browser.close();

  // (brand, model) UNIQUE 제약 회피: 같은 상품이 여러 카테고리 노출되는 등.
  // brand=null 인 행은 model 단독으로 dedupe (퐁당 데이터에선 발생 빈도 낮음).
  const dedup = new Map<string, SeedRow>();
  for (const r of allRows) {
    const key = `${r.brand ?? ""}::${r.model}`;
    if (!dedup.has(key)) dedup.set(key, r);
  }
  const finalRows = [...dedup.values()];

  if (finalRows.length === 0) {
    console.log("\n수집된 상품 0건 — 출력 생략");
    if (errors.length) console.log("에러:", errors.join("; "));
    return;
  }

  const sql = toSql(finalRows);
  writeFileSync("./seed-products.sql", sql, "utf8");

  const matched = finalRows.filter((r) => r.brand_en).length;
  const branded = finalRows.filter((r) => r.brand).length;
  console.log("");
  console.log(`총 ${finalRows.length} 행 → seed-products.sql`);
  console.log(`브랜드 있음: ${branded} (영문 매핑됨 ${matched})`);
  if (errors.length) {
    console.log("실패한 카테고리:");
    for (const e of errors) console.log(`  - ${e}`);
  }
}

// CLI 직접 실행시에만 main(). import 만 했을 때(테스트 등) 자동 트리거 방지.
const isMain =
  import.meta.url.startsWith("file:") &&
  process.argv[1] &&
  import.meta.url.includes(
    process.argv[1].replace(/\\/g, "/").split("/").pop() || "",
  );

if (isMain) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
