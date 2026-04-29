# Google Cloud / Places API 셋업 가이드

DiveLog 의 위치 검색 + 지도 기능에 필요한 Google Cloud 프로젝트 셋업 가이드.

## 우리가 쓰는 API 와 비용 전략

| 기능 | API | 비용 | 1건당 콜 |
|---|---|---|---|
| 내 위치 자동 채움 | `expo-location` (OS 네이티브) | **무료** | 0 |
| 직접 입력 | (없음) | **무료** | 0 |
| 지명/샵 이름 검색 | Places **Text Search** (Essentials) | $5/1000, 월 10K 무료 | **1콜** |
| 지도 렌더링 | Maps SDK (Android/iOS) | **무료, 무제한** (모바일) | 0 |

**자동완성(Autocomplete) API는 쓰지 않음** — 글자마다 호출돼서 비효율적. Text Search 한 번에 끝나는 게 5~6배 효율적이고 무료 한도가 사실상 10,000건/월로 늘어남.

**비용 통제는 두 단계**:
1. **앱 레벨 캡** (마이그레이션 `009_places_api_usage.sql` 으로 자동 적용) — 333/일 enforce → 월 9,990 < 10K 무료 한도
2. **사용량 알림** (콘솔에서 설정) — 캡이 어쩌다 뚫리면 즉시 메일

---

## 사전 준비물

- ✅ Google 계정 (개인 Gmail 가능)
- ✅ 신용/체크카드 (Google Cloud는 모든 API에 결제 계정 등록을 요구. 다만 하드 쿼터 거니까 안전)
- ✅ Expo 프로젝트 번들 ID (이미 발급됨: `com.woozoo.divelog`)
- ✅ Android 키스토어 SHA-1 지문 (개발용 debug.keystore + EAS 프로덕션 키)

---

## 두 종류의 무료를 혼동하지 말 것

가입 시 표시되는 **"$300 / 90일 크레딧"** 과 우리가 의지하는 **"Always-Free 한도"** 는 별개.

| 종류 | 기간 | 한도 | 의미 |
|---|---|---|---|
| 신규 가입 크레딧 | 90일 | $300 | 시작 보너스. 90일 지나면 만료 |
| **Always-Free 한도** | **영구** | Places API 월 10,000콜 | **우리가 영원히 의지하는 한도** |

90일 트라이얼이 끝나도 Always-Free 한도는 사라지지 않음. 만료 시점에 "유료 계정으로 업그레이드" 한 번 클릭하면 그대로 영구 무료 한도 + 앱 레벨 캡(Phase 2) 으로 0원 유지.

> 트라이얼 만료 시 자동 청구 없음 — 업그레이드 안 누르면 서비스만 정지되고 청구는 안 됨.

---

## Phase 1 — Cloud 프로젝트 + API 활성화 (5분)

1. <https://console.cloud.google.com/> 접속 → 로그인
2. 상단 프로젝트 선택기 → **새 프로젝트**
   - 프로젝트 이름: `divelog-prod` (자유)
   - 조직: 없음 (개인 계정)
   - **만들기**
3. 새 프로젝트 선택됐는지 상단 확인 후 좌측 햄버거 → **결제** → **결제 계정 연결**
   - 카드 정보 입력. 이 시점에 카드가 등록되지만 다음 단계에서 쿼터 캡 걸 거라 안전
4. 좌측 햄버거 → **API 및 서비스** → **라이브러리**
5. 다음 3개 검색 후 각각 **사용 설정**:
   - `Places API (New)` ← Text Search (지명/샵 검색)
   - `Maps SDK for Android` ← 지도 렌더링 (모바일은 무료 무제한)
   - `Maps SDK for iOS` ← 지도 렌더링 (모바일은 무료 무제한)

> ⚠️ "Places API"(레거시)와 "Places API (New)"는 다름. **반드시 New 쪽** 활성화.

---

## Phase 2 — 사용량 알림 + 앱 레벨 캡 (5분)

> **중요**: Maps Platform 의 할당량은 콘솔에서 **낮출 수 없음** (`조정 가능 여부: 아니요`).
> 그래서 두 단계로 막는다:
> 1. **앱 레벨 캡** (마이그레이션 `009_places_api_usage.sql` 으로 이미 들어감) — 일별 333콜 enforce
> 2. **사용량 알림** (콘솔에서 설정) — 캡이 어쩌다 뚫리면 즉시 알림

### 2-1. 사용량 알림 만들기

1. **API 및 서비스 → 할당량 및 시스템 한도** (또는 Maps Platform → 할당량)
2. 필터에서 `Places API (New)` 선택
3. `SearchTextRequest per day` 행 좌측 체크박스 클릭 ← 우리가 쓸 SKU
4. 상단 **사용량 알림 만들기** 클릭
5. 임계값:
   - **1%** (≈ 750/75,000) — 무료 한도(10K) 도달 훨씬 전에 알림 받기 위함
   - **알림 이메일**: 본인 이메일 ✅
6. 저장

### 2-2. 앱 레벨 캡 — 자동으로 적용됨

`supabase/migrations/009_places_api_usage.sql` 가 다음을 만들어둠:
- `places_api_usage` 테이블 (일별 카운터)
- `bump_places_usage()` RPC — 매 호출 직전에 +1, 333 초과 시 `allowed=false` 반환

클라이언트 (`mobile/src/services/places-api/usage-guard.ts`) 는 매 Places 호출 직전 이 RPC를 호출해서 `allowed=false` 면 Google 호출 자체를 안 함 → 폴백 UI(직접 입력) 로 자동 전환.

이중 안전판:

| 레이어 | 한도 | 어떻게 |
|---|---|---|
| 1. 앱 (Supabase RPC) | **333/일 = 9,990/월** | 마이그레이션 적용 시 자동 |
| 2. Google 무료 한도 | 10,000/월 | Google이 자동 |
| 3. Cloud Billing 예산 알림 | $1 도달 시 메일 | Phase 3 에서 설정 |

캡 변경하려면 마이그레이션의 `p_cap` 기본값(333)을 수정하거나, 호출 시 인자로 전달.

---

## Phase 3 — 예산 알림 (선택, 안심용 백업)

쿼터로 이미 막혀있지만 이중 안전판으로 추가.

1. 좌측 햄버거 → **결제 → 예산 및 알림**
2. **예산 만들기**
   - 이름: `divelog-monthly-cap`
   - 범위: `divelog-prod` 프로젝트
   - 금액: `$1` (사실상 0원이어야 정상 — $1 도달 시 알림 받으면 무언가 잘못된 것)
   - 알림 임계값: 50%, 90%, 100%
   - 이메일로 알림 받기 ✅
3. **저장**

---

## Phase 4 — API 키 발급

> **지금 PR 에서 필요한 건 `divelog-places-http` 한 개만.** 위치 검색 + GPS 만 쓰니까 Maps 키는 불필요.
> Maps 키 2개 (iOS / Android) 는 **지도 뷰 추가하는 다음 PR(Phase 2)** 때 발급. SHA-1 도 그때 처리.

세 개 모두 분리해서 발급할 예정 (권한 격리로 키 유출 시 피해 범위 한정):

| 키 이름 | 용도 | 제한 | 언제 |
|---|---|---|---|
| `divelog-places-http` | Places Text Search HTTP 호출 | API 제한만 (앱 제한 X) | **지금** |
| `divelog-maps-ios` | Maps SDK 지도 렌더링 (iOS) | 번들 ID `com.woozoo.divelog` | 지도 뷰 PR |
| `divelog-maps-android` | Maps SDK 지도 렌더링 (Android) | 패키지명 + SHA-1 | 지도 뷰 PR |

### 4-1. Places HTTP 키 (지금 PR 에 필요한 유일한 키)

1. **API 및 서비스 → 사용자 인증 정보 → + 사용자 인증 정보 만들기 → API 키**
2. 발급된 키 옆 연필 아이콘 → **편집**
3. 이름 `divelog-places-http` 로 변경
4. **애플리케이션 제한사항**: `없음` (RN HTTP 호출은 번들 ID/SHA-1 안 실어 보냄)
5. **API 제한사항**: `키 제한` → **Places API (New) 만** 체크
6. 저장

> **이 키는 앱 번들에 노출됨.** 그래서 **앱 레벨 캡(Phase 2)** 가 결정적 — 키가 유출되어도 333/일에서 멈춤. 추후 Supabase Edge Function 으로 프록시하면 서버 사이드로 숨길 수 있음 (P2 하드닝).

### 4-2. iOS Maps 키 (지도 뷰 PR 에서 — 지금은 건너뛰기)

1. 다시 **+ 사용자 인증 정보 만들기 → API 키**
2. 이름 `divelog-maps-ios` 로 변경 → **편집**
3. **애플리케이션 제한사항**: `iOS 앱` → 번들 ID `com.woozoo.divelog` 추가
4. **API 제한사항**: `키 제한` → **Maps SDK for iOS 만** 체크
5. 저장

### 4-3. Android Maps 키 (지도 뷰 PR 에서 — 지금은 건너뛰기)

1. 다시 **+ 사용자 인증 정보 만들기 → API 키**
2. 이름 `divelog-maps-android` → **편집**
3. **애플리케이션 제한사항**: `Android 앱` → 패키지 `com.woozoo.divelog` + SHA-1 추가 (아래 4-4 참고)
4. **API 제한사항**: `키 제한` → **Maps SDK for Android 만** 체크
5. 저장

### 4-4. Android SHA-1 지문 구하기 (Maps Android 키 발급할 때만 필요)

> SHA-1 = Android 빌드 서명 지문. Google 한테 "이 지문 있는 앱만 우리 키 써도 됨" 매칭용.
> Maps SDK 안 쓸 거면 신경 안 써도 됨.

#### debug.keystore 가 이미 있는 경우 (Android Studio 또는 `expo run:android` 실행 경험 있음)

```powershell
# Windows PowerShell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | Select-String SHA1
```

#### debug.keystore 가 없는 경우 (Android 환경 한 번도 안 만진 상태)

먼저 표준 debug.keystore 생성 (Android Studio 가 자동으로 만드는 것과 동일):

```powershell
$ks = "$env:USERPROFILE\.android\debug.keystore"
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.android" | Out-Null
keytool -genkey -v -keystore $ks `
  -storepass android -alias androiddebugkey -keypass android `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -dname "CN=Android Debug,O=Android,C=US"
```

그 다음 SHA-1 추출:

```powershell
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android | Select-String SHA1
```

출력 예: `SHA1: 43:56:D3:53:51:16:B7:80:47:06:5C:4B:3E:C8:65:FC:F5:05:A9:38`

#### 프로덕션 (EAS Build) — 출시 직전에 추가

```bash
cd mobile
eas credentials
# Android → production → "View Keystore" → SHA-1 Fingerprint 복사
```

처음에는 dev SHA-1 하나만 등록하고, EAS 첫 production 빌드 후 그 SHA-1 도 같은 키 제한에 add 해야 production 앱에서 Maps 동작.

---

## Phase 5 — 키를 앱에 주입 (3분)

### 5-1. `.env` 추가 (지금 PR 기준 — Places 키만)

```bash
# mobile/.env (gitignore 처리됨)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...Places-HTTP키
```

지도 뷰 PR 때 추가될 줄:

```bash
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS=AIzaSy...iOS-Maps키
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID=AIzaSy...Android-Maps키
```

> 이름에 `EXPO_PUBLIC_` 프리픽스가 붙어야 RN 번들에 포함됨.
> Places 키는 노출되지만 4-1 의 API 제한 + Phase 2 의 앱 레벨 캡으로 보호됨.

### 5-2. `mobile/app.json` 에 네이티브 Maps 키 등록 (지도 뷰 PR 때)

지도 렌더링 키만 네이티브 빌드 시 필요 — Places HTTP 키는 fetch 헤더에만 들어감.

```jsonc
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.woozoo.divelog",
      "config": {
        "googleMapsApiKey": "AIzaSy...iOS키"
      }
    },
    "android": {
      "package": "com.woozoo.divelog",
      "config": {
        "googleMaps": {
          "apiKey": "AIzaSy...Android키"
        }
      }
    }
  }
}
```

> 이 키는 앱 바이너리에 들어감 — 그래서 Phase 4 에서 **번들 ID + SHA-1 제한**이 결정적. 제한이 있으면 키가 유출돼도 다른 앱에서는 못 씀.

### 5-3. EAS 시크릿 (프로덕션 빌드용)

`.env` 는 로컬 개발용이고, EAS Build 에는 별도 등록:

```bash
cd mobile
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_PLACES_API_KEY --value "AIzaSy...Places-HTTP키"

# 지도 뷰 PR 때 추가:
# eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_IOS --value "AIzaSy...iOS-Maps키"
# eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_ANDROID --value "AIzaSy...Android-Maps키"
```

---

## Phase 6 — 검증 (2분)

1. `cd mobile && npm run start` → 개발 서버 띄우기
2. 새 다이브 로그 화면 → "📍 내 위치" 버튼: GPS 권한 허락 → country/location 자동 채움 (Google API 안 거침, 무료)
3. 검색창에 "제주 문섬" 입력 → "검색" 탭 → 결과 1~3개 → 선택하면 좌표까지 저장
4. 콘솔에 `REQUEST_DENIED` 떨어지면:
   - Places HTTP 키의 API 제한 확인 (Places API New?)
   - API 활성화 확인 (라이브러리에서 Places API New 켜졌나?)
5. **API 및 서비스 → 측정항목** 에서 `SearchTextRequest` 호출이 카운트되는지 확인 (1분 정도 지연됨)

---

## 운영 체크리스트

- [ ] 앱 레벨 캡 333/일 — Supabase `places_api_usage` 테이블에서 일별 누계 확인 가능
- [ ] 사용자가 갑자기 늘면 무료 한도(10K) 가까워질 수 있음 → 캡 값을 RPC 인자로 동적 조정 가능
- [ ] EAS 프로덕션 SHA-1 추가 잊지 말기 (안 하면 프로덕션 Maps 키 거부됨)
- [ ] 6개월마다 `사용자 인증 정보` 점검 — 안 쓰는 키 삭제

---

## 비용 시뮬레이션 (참고)

앱 레벨 캡 333/일 = 월 9,990콜 보장. Text Search 1콜/검색 패턴:

| 월 검색 횟수 | Text Search 콜 | 청구 |
|---|---|---|
| 1,000건 | 1,000 (한도 10%) | $0 |
| 5,000건 | 5,000 (한도 50%) | $0 |
| 9,000건 | 9,000 (한도 90%) | $0 |
| 10,000건+ | 캡 도달 → 클라이언트가 폴백(직접 입력)으로 전환 | $0 |

GPS 자동 채움이 절반 이상 차지하면(예상) **무료 한도가 실질적으로 다이브 20,000건/월** 으로 확장됨.

---

## 트러블슈팅

| 증상 | 원인 / 해결 |
|---|---|
| `REQUEST_DENIED` (Maps Android) | SHA-1 미등록 또는 패키지명 오타. `eas credentials` 또는 keytool로 재확인 |
| `REQUEST_DENIED` (Maps iOS) | `app.json` 의 bundleIdentifier 와 키 제한의 번들 ID 불일치 |
| `REQUEST_DENIED` (Places HTTP) | Places HTTP 키의 API 제한 확인. Places API (New) 체크되어 있어야 함 |
| 앱 캡 도달 (`bump_places_usage allowed=false`) | 정상 동작 — 클라이언트가 자동으로 직접 입력 폴백으로 전환됨 |
| 지도가 회색 화면 | `googleMapsApiKey` 가 `app.json` 에 없음 또는 `Maps SDK for {iOS,Android}` 미활성화 |
| `BILLING_DISABLED` | Phase 1 결제 계정 연결 누락 |
