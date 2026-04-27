# 다음 세션 핸드오프 — 인증 흐름 구현

> 작성일: 2026-04-27
> 마지막 검증: media-server `/health` → `{"ok":true}` 확인 완료
> 다음 세션 목표: 이메일 로그인 → 온보딩 → 첫 다이브 INSERT 까지 동작하는 풀스택 사이클 완성

---

## 1. 지금까지의 상황 (현재 상태)

### ✅ 완료된 인프라
| 영역 | 상태 | 위치 |
|---|---|---|
| Supabase 프로젝트 | 가동 중 | `tplucxbixshvunsdfqcg.supabase.co` |
| DB 스키마 (17테이블 + RLS) | 마이그레이션 001, 002 적용됨 | `supabase/migrations/` |
| Supabase JWT Secret | media-server `.env`에 설정됨 | NAS `/volume1/docker/divelog/media-server/.env` |
| Storage 버킷 | `dive-media`, `avatars` (public) | Supabase 대시보드 |
| Email Auth | "Confirm email" 켜짐 상태 가능성 | Supabase Auth 설정 확인 필요 |
| Cloudflare Tunnel | `media.dooname.cloud` → NAS | Zero Trust 대시보드 |
| Media Server | Docker로 NAS DS220+에서 가동 | `/volume1/divelog-media/` 가 저장 위치 |
| Mobile 앱 골격 | 빌드 가능, typecheck 통과 | `mobile/` |

### ⏳ 다음 세션에서 작업할 영역
| 영역 | 상태 | 이번 세션 목표 |
|---|---|---|
| 이메일 가입/로그인 | UI placeholder만 (`app/(auth)/login.tsx`) | 실제 Supabase Auth 연결 |
| 온보딩 | placeholder만 | 닉네임 입력 → `profiles` INSERT |
| 라우트 가드 | 없음 | 미인증 → `/login`, 프로필 없음 → `/onboarding` |
| 로그북 데이터 | TanStack Query 훅은 있지만 빈 결과 | 더미 다이브 INSERT 후 표시 확인 |
| 로그아웃 | `profile.tsx`에 버튼만 있음 | 실제 동작 확인 |

### ❌ 한참 뒤에 (이번 세션 범위 외)
- BLE 실제 통신 (`packet.ts`, `decompress.ts`, `shearwater.ts` 본체 포팅)
- 사진/영상 업로드 UI 통합
- 카카오/구글/애플 OAuth
- 피드/Q&A
- 샵 탐색기

---

## 2. 이번 세션의 구체적 목표

**한 줄 요약**: "사용자가 가입 → 닉네임 입력 → 임시 다이브 1개 추가 → 로그북에서 보임" 까지 동작.

### 5가지 산출물

1. **`mobile/app/(auth)/login.tsx`** — 이메일/비밀번호 가입+로그인 토글 폼
2. **`mobile/app/(auth)/onboarding.tsx`** — 닉네임/자격등급 입력 + `profiles` INSERT
3. **`mobile/app/_layout.tsx`** 수정 — 라우트 가드 (미인증 시 redirect)
4. **`mobile/app/log/new.tsx`** 임시 폼 — 수동 다이브 INSERT (BLE 없이)
5. **종단간 검증** — `(tabs)/logbook.tsx` 에서 방금 추가한 다이브가 보이는지

---

## 3. 구현 가이드 — 순서대로

### Step 1 — Supabase 사전 설정 (작업 전 5분)

1. Supabase 대시보드 → **Authentication → Sign In / Providers**
2. **Email** 제공자 클릭 → **Confirm email** 토글 **OFF** → Save
   - 이래야 가입 즉시 로그인되어 dev에서 빠르게 테스트 가능. 운영 단계에서 다시 ON.
3. (선택) **Authentication → URL Configuration** → Site URL 비워둬도 OK

### Step 2 — `useAuthStore`에 가입/로그인 메서드 추가

현재 `mobile/src/store/auth-store.ts`는 `hydrate`, `setSession`, `signOut`만 있음. 가입/로그인 추가 필요:

```ts
// auth-store.ts 에 추가
signUp: async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
},
signIn: async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
},
```

### Step 3 — `mobile/app/(auth)/login.tsx` 실제 폼

요구사항:
- 이메일/비밀번호 두 input (`<TextInput>`)
- "로그인" / "가입" 토글
- 버튼 → `useAuthStore.signIn` or `signUp` 호출
- 성공 시 라우트 가드가 알아서 다음 화면으로 보냄 (`router.replace` 불필요, 가드가 처리)
- 에러 시 `Alert.alert`로 표시

키보드 처리: `KeyboardAvoidingView` 감싸기 (iOS).

### Step 4 — `useProfile` 훅 만들기

`mobile/src/hooks/use-profile.ts` 신규:
```ts
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .maybeSingle();   // ← 없을 수 있음 (가입 직후)
      if (error) throw error;
      return data;
    },
  });
}
```

`maybeSingle()` 중요. `single()`은 0행이면 에러를 던짐.

### Step 5 — `mobile/app/(auth)/onboarding.tsx` 구현

요구사항:
- 닉네임 input (필수, unique)
- 자격등급 select (Open Water / Advanced / Rescue / Divemaster / Instructor)
- 다이빙 단체 select (PADI / SSI / SDI / NAUI / 기타)
- 누적 다이브 횟수 input (number, 기본 0)
- "시작하기" 버튼 → `supabase.from('profiles').insert(...)` → 성공 시 가드가 `(tabs)`로 보냄

INSERT 시 `id`는 `auth.uid()` 와 같아야 RLS 통과. Supabase JS는 자동으로 안 넣어주니 명시:
```ts
await supabase.from('profiles').insert({
  id: user.id,         // ← 명시 필수
  nickname,
  certification,
  diving_org: divingOrg,
  total_dives_at_signup: totalDives,
});
```

### Step 6 — 라우트 가드 (`mobile/app/_layout.tsx` 수정)

Expo Router v6 패턴: `<Stack>` 안에 조건부 redirect 사용.

```tsx
import { Redirect, Stack, useSegments } from "expo-router";

export default function RootLayout() {
  // ... 기존 hydrate 로직
  const session = useAuthStore((s) => s.session);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const userId = session?.user.id;
  const { data: profile, isLoading: isProfileLoading } = useProfile(userId);

  const segments = useSegments();
  const inAuthGroup = segments[0] === "(auth)";

  if (!isHydrated) return null;  // splash
  if (!session && !inAuthGroup) return <Redirect href="/(auth)/login" />;
  if (session && !profile && !isProfileLoading && segments[1] !== "onboarding") {
    return <Redirect href="/(auth)/onboarding" />;
  }
  if (session && profile && inAuthGroup) return <Redirect href="/(tabs)" />;

  return (
    <QueryClientProvider client={queryClient}>
      {/* ... 기존 ThemeProvider + Stack */}
    </QueryClientProvider>
  );
}
```

⚠️ `useProfile` 훅이 `QueryClientProvider` 밖에서 호출되면 깨짐. 해결책:
- 옵션 A: Provider를 Layout 위로 끌어올린 별도 컴포넌트로 분리
- 옵션 B: 가드를 `(tabs)/_layout.tsx` 와 `(auth)/_layout.tsx` 로 분산

**추천 = 옵션 A**. `_layout.tsx`를 다음처럼 분리:
```tsx
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider ...>
        <RootGuard />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function RootGuard() {
  // 위의 가드 로직 + <Stack> 반환
}
```

### Step 7 — 임시 다이브 INSERT 폼 (`mobile/app/log/new.tsx`)

기존 placeholder를 다음으로 대체 (BLE 없이 수동):
- 국가, 지역, 포인트 input
- 시작/종료 시간 input (date picker)
- 최대 수심, 평균 수심, 수온, 시야 input (number)
- 메모 textarea
- "저장" 버튼 → 다음 INSERT:

```ts
const { data: count } = await supabase.from('dives').select('dive_number', { count: 'exact', head: true }).eq('user_id', userId);
const nextNumber = (count ?? 0) + 1;

await supabase.from('dives').insert({
  user_id: userId,
  dive_number: nextNumber,
  country, location, point,
  started_at: startedAt.toISOString(),
  ended_at: endedAt.toISOString(),
  max_depth: maxDepth,
  avg_depth: avgDepth,
  water_temp: waterTemp,
  visibility,
  weather: 'sunny',
  is_verified: false,   // ← BLE 없이 수동 입력이라 false
});

queryClient.invalidateQueries(['dives', userId]);
router.back();
```

### Step 8 — 검증 시나리오

1. `cd mobile && npm start` → Expo Go에서 QR 스캔
2. 첫 화면이 `/login` 이어야 함 (가드 동작)
3. 가입: 임의의 이메일/비밀번호 → 자동으로 `/onboarding` 로
4. 닉네임 입력 → 시작하기 → `/(tabs)` 로 진입
5. 로그북 탭 → "아직 기록된 다이브가 없습니다" 표시
6. 가운데 + 버튼 → "다이빙 로그 기록" → 폼 작성 → 저장
7. 로그북 탭으로 돌아가면 방금 추가한 다이브가 카드로 보임 🎉
8. 프로필 탭 → 로그아웃 → `/login` 으로 돌아감

이 8단계가 다 동작하면 **MVP 인증/CRUD 사이클 완성**.

---

## 4. 핵심 파일 위치 (빠른 레퍼런스)

| 파일 | 역할 | 수정 필요 여부 |
|---|---|---|
| `mobile/src/services/supabase.ts` | Supabase 클라이언트 | ❌ 그대로 |
| `mobile/src/store/auth-store.ts` | Zustand auth 스토어 | ✅ signUp/signIn 추가 |
| `mobile/src/hooks/use-dives.ts` | 다이브 쿼리 | ❌ 이미 작성됨 |
| `mobile/src/hooks/use-profile.ts` | 프로필 쿼리 | ✅ 신규 생성 |
| `mobile/app/_layout.tsx` | 루트 레이아웃 + 가드 | ✅ 가드 추가 |
| `mobile/app/(auth)/login.tsx` | 로그인 폼 | ✅ 본문 구현 |
| `mobile/app/(auth)/onboarding.tsx` | 온보딩 | ✅ 본문 구현 |
| `mobile/app/(tabs)/logbook.tsx` | 로그북 리스트 | ❌ 이미 작성됨 |
| `mobile/app/(tabs)/profile.tsx` | 프로필 + 로그아웃 | ❌ 이미 작성됨 |
| `mobile/app/log/new.tsx` | 다이브 작성 폼 | ✅ 임시 수동 폼 구현 |
| `supabase/migrations/001_initial_schema.sql` | 스키마 | ❌ 이미 적용됨 |
| `media-server/src/index.ts` | 업로드 서버 | ❌ 이번 세션에선 안 씀 |

---

## 5. 주요 결정사항 (왜 이렇게 만들었나)

| 결정 | 이유 |
|---|---|
| Email Auth 먼저 (소셜 X) | 카카오/구글 OAuth는 외부 발급 필요 → 시간 소요. 이메일은 즉시 가능. 소셜은 V1.1 |
| `Confirm email` OFF | 개발 속도. 운영 전엔 다시 ON |
| 라우트 가드 = 루트 레이아웃 redirect 패턴 | Expo Router v6 권장. 미들웨어보다 명시적 |
| 다이브 INSERT 수동 폼 | BLE 통합 전에 CRUD 사이클 검증. BLE 도입 시 동일 INSERT 재사용 |
| `is_verified=false` 수동 입력 | "Verified Data" 뱃지는 BLE 통신 결과만 true. 수동 입력은 사용자가 변조 가능하므로 |
| `dive_number`를 클라이언트 계산 | 사용자별 1부터 증가. 동시성 우려는 솔로 다이버 시나리오라 무시 가능 |

---

## 6. 알려진 함정

### 환경
- `mobile/.env` 변경 시 **반드시 `npm start` 재시작**. Expo는 환경변수를 빌드 타임에 읽음
- Expo Go에서는 `react-native-ble-plx` 동작 안 함 (네이티브 모듈) → 이번 세션 작업과는 무관 (BLE 안 씀)
- iOS는 `KeyboardAvoidingView` 필요. Android는 보통 자동 처리

### Supabase RLS
- `profiles INSERT` 시 `id`를 `auth.uid()`와 같게 명시해야 통과. 안 그러면 `new row violates row-level security policy`
- `dives INSERT` 시 `user_id`도 마찬가지
- 디버깅 팁: SQL Editor에서 동일 쿼리 실행 시엔 superuser라 RLS 무시됨. 앱에서만 실패하면 RLS 의심

### 라우트 가드 무한 루프
- `useProfile` 의 `isLoading` 동안에는 redirect 안 하도록 가드 (Step 6 코드의 `!isProfileLoading` 조건)
- `(auth)` 안에서 `(auth)`로 redirect 시도 안 하게 segments 체크 필수

### TypeScript
- `database.ts`는 placeholder. 정식 타입 자동 생성하려면:
  ```bash
  npx supabase gen types typescript --project-id tplucxbixshvunsdfqcg > mobile/src/types/database.ts
  ```
  (이 세션에서 해도 좋음. 그러면 `supabase.from('dives').select()` 자동완성됨)

---

## 7. 빠른 시작 명령

새 세션에서 작업 시작:
```bash
cd C:\Users\coreit\woozoo_dive_project

# 모바일 개발 서버
cd mobile
npm install      # 첫 시작이거나 deps 변경 시
npm start        # Expo Go 용 QR 표시

# 타입 체크
npm run typecheck

# media-server (NAS에 이미 떠있어서 로컬에선 평소 안 띄움)
# 필요 시:
cd ../media-server
npm install
npm run dev
```

NAS에서 미디어 서버 상태 확인:
```bash
# 브라우저
https://media.dooname.cloud/health  → {"ok":true}

# SSH
ssh admin@<NAS-IP>
docker ps                                    # divelog-media-server, divelog-cloudflared 둘 다 Up
docker logs --tail 20 divelog-media-server
docker logs --tail 20 divelog-cloudflared
```

---

## 8. 이전 세션의 큰 결정 요약 (참조용)

1. **플랫폼**: React Native + Expo SDK 54 (Flutter 등 비교 후 결정)
2. **BLE**: 옵션 A — RN 앱이 직접 Shearwater 통신 (Python downloader는 레퍼런스로 보존)
3. **백엔드**: Supabase 유지 (자체 백엔드 직접 구현 vs BaaS 비교 후)
4. **미디어**: Synology NAS DS220+ + Cloudflare Tunnel (영상 4K 때문에 Supabase Storage 부적합)
5. **외부 노출**: Cloudflare Tunnel (NPM과 공존, `media.dooname.cloud`만 터널로)
6. **인증 우선순위**: 이메일 → 라우트 가드 → 로그북 CRUD → (그 다음) BLE → 영상

---

## 9. 새 세션 시작 멘트 예시

새 Claude 세션에 다음과 같이 말하면 컨텍스트 빠르게 잡힘:

> "WOOZOO/DiveLog 프로젝트를 이어서 작업할게. CLAUDE.md 와 docs/next-session.md 를 읽고 인증 흐름부터 구현해. 먼저 Supabase Email Confirm 설정만 확인해주고 Step 2 부터 진행."

---

**끝.** 막히는 부분 있으면 이 문서의 Step 번호 + 무슨 에러인지 알려주면 바로 짚어줍니다.
