# 퐁당닷컴 브랜드 시드 크롤러 (1회성)

스쿠버 다이빙 장비 카테고리별 **브랜드 리스트**를 퐁당닷컴 카탈로그 페이지에서 추출해 `equipment_brands` 시드 SQL 을 생성한다.

## 무엇을 / 무엇을 하지 않는지

- ✅ 카테고리별 **브랜드명** (사실 정보 — 저작권 X)
- ✅ 우리 앱 내부 카테고리 enum 으로 매핑
- ✅ 서버 렌더링 HTML 만 사용 (정적 파싱)
- ❌ 상품 이미지 / 가격 / 상세 (저작권 우려)
- ❌ 런타임 호출 (1회성, 결과는 SQL로 박제)

## 사용

### 1) 브랜드 시드 (가벼운 정적 크롤, 15초)

```bash
cd tools/crawler
npm install
npm run seed
# → ./seed.sql 생성
```

생성된 `seed.sql` 을 Supabase SQL Editor 에서 실행. 006 마이그레이션이 먼저 적용돼 있어야 함.

### 2) 상품 풀 시드 (Playwright 헤드리스, ~10-20분)

이 단계는 무겁지만 **실 상품명**(브랜드 + 모델)을 카탈로그에 채움. 퐁당의 메인 그리드 마크업이 `<span class="brand_name">` + `<span class="name">` 으로 분리돼 있어 정확히 추출됨.

```bash
cd tools/crawler
npm install                          # 처음 한 번
npx playwright install chromium      # 처음 한 번 (~250MB 다운로드)
npm run seed:products
# → ./seed-products.sql 생성
```

**기존 시드가 이미 있으면 먼저 정리** (마케팅 prefix 정리/중복 방지):

```sql
-- Supabase SQL Editor 에서:
delete from public.equipment where source = 'pongdang_seed';
```

그 다음 생성된 `seed-products.sql` 을 SQL Editor 에서 실행. 006/007 마이그레이션 적용 후.

#### 모델명 정리

크롤러가 자동으로 마케팅 prefix 를 제거함:
- `[재입고 미정] 갈릴레오 HUD` → `갈릴레오 HUD`
- `★특별 세일★ MK25 EVO` → `MK25 EVO`
- `[옵션증정] ★할인★ 디센트 G1` → `디센트 G1`

이미 시드된 데이터를 **새로 크롤하지 않고** 같은 자리에서 정리하려면 `cleanup-prefixes.sql` 사용.

## 결과물

`equipment_brands` 테이블에:

| name | category | source |
|------|----------|--------|
| 스쿠버프로 | MASK | pongdang_seed |
| 스쿠버프로 | BCD | pongdang_seed |
| 마레스 | MASK | pongdang_seed |
| ... | ... | ... |

## 법적 / 윤리적 메모

- 추출 대상은 브랜드명(사실 정보)으로 한정. 한국 저작권법 § 91-2(데이터베이스권)는 "상당한 투자로 만든 DB의 상당한 부분"을 보호하는데, 우리는 카테고리별 ~50개씩 브랜드명만 발췌해 전혀 다른 목적(개인 다이빙 로그)에 사용 → 침해 인정 어려움.
- 1회성 실행이며 앱 런타임에 퐁당을 호출하지 않음.
- robots.txt 는 본 스크립트 실행 전 수동으로 확인 권장.
