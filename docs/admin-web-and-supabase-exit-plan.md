# 웹 관리자 페이지 + Supabase 의존도 감축 검토

> **상태**: 보류 (2026-05-06 논의)
> **재검토 트리거**: Supabase 무료 한도 근접 / 비개발자 운영자 합류 / 운영 도구 부재로 병목 발생 시

## 배경

현재 구조:
- **Auth + DB**: Supabase (RLS 78개 정책으로 보안 enforce)
- **Media**: NAS (Synology DS220+) + Hono 기반 `media-server` + Cloudflare Tunnel
- **클라이언트**: RN 앱이 Supabase JS SDK로 DB 직접 접근, user JWT 기반 RLS 자동 적용

논의 동기 (둘 다 해당):
1. **운영 관리자 UI 필요** — 비개발자가 앱을 운영할 예정. Supabase Dashboard로는 부족.
2. **Supabase 의존도 감축 대비** — 한도 / 정책 / 비용 변화에 대비한 탈출 경로 확보.

## 핵심 정리: "의존도 감축" ≠ "RLS 포기"

두 개념을 분리해서 봐야 의사결정이 깔끔해진다.

### RLS는 어디로 가도 살릴 수 있다
- Supabase = Postgres + 부가 서비스. **RLS는 Postgres 기본 기능**이라 self-host(NAS Docker)로 옮겨도 78개 정책 그대로 유지된다.
- RLS가 무력화되는 진짜 시나리오: **"백엔드를 통해서만 DB 접근"으로 바꾸는 경우.**
  - 백엔드가 `service_role`로 DB에 들어가는 순간 RLS는 사실상 무시됨
  - 권한 체크 책임이 **DB → 백엔드 코드**로 이동
  - 백엔드 코드에 권한 체크 한 줄 빠지면 그대로 노출
  - 78개 RLS 정책 = 백엔드 코드 78곳의 권한 체크

### 비개발자 운영자가 끼면 admin UI 자체가 새 공격면
- Admin 계정 = `service_role` 권한 (모든 사용자 데이터 read/write).
- 이 계정이 털리면 RLS 78개는 의미 없음.
- Admin UI 구축 시 필수 보안 항목:
  1. **인증 분리** — 일반 사용자 DB와 분리된 admin 인증 테이블/도메인
  2. **2FA 강제** — TOTP 또는 WebAuthn
  3. **Audit log** — 모든 admin 액션 기록 (누가/언제/무엇을)
  4. **접근 제한** — Cloudflare Access 또는 IP allowlist
  5. **Service role key 격리** — 절대 브라우저로 내려가지 않게, NAS 백엔드 안에서만 사용

이 작업이 RLS 78개 정책보다 무겁다고 봐야 함.

## 점진적 이행 로드맵

### Phase 1 — Admin 웹만 추가 (현 시점에서 가장 합리적)
- **Supabase는 그대로 유지.**
- `media-server/`를 `backend/`로 확장 — 같은 Hono 앱에 admin 라우트 + 정적 웹 (Next.js 또는 Vite+React) 추가.
- NAS 한 도메인에서 `/admin` 서빙.
- `service_role key`는 NAS 백엔드 내부에서만 사용.
- **이점**: 운영 도구 확보 + 탈출 발판 동시 확보, 보안 리스크 낮음.
- **변경 범위**: backend 신규, RN 앱 변경 없음, DB 변경 없음.

### Phase 2 — Postgres self-host (Supabase 한도 도달 시)
- Postgres만 NAS 또는 별도 서버로 옮기고 **RLS 그대로 유지**.
- Auth는 Supabase Auth 유지하거나 GoTrue self-host.
- RN 앱은 PostgREST 또는 Hono 통해 접근하되 **user JWT 그대로 전달** → RLS 계속 작동.
- **이점**: Supabase 비용/한도 탈출하면서도 보안 모델 유지.
- **부담**: 백업/모니터링/HA 운영 책임이 자체 인프라로.

### Phase 3 — 자체 백엔드 풀스택 (마지막 선택지)
- Postgres + 자체 Hono API + JWT 인증 직접 구현.
- RLS는 사실상 폐기, 모든 권한 체크 백엔드 코드로 이동.
- **보안 작업이 가장 큼** — 정말 필요할 때만. (예: Supabase Auth 못 쓸 때, 복잡한 비즈니스 로직 권한)

## 결정 사항

- **현 시점: 보류.** Phase 1 진행 안 함.
- 재검토 트리거에 해당하는 상황이 발생하면 Phase 1부터 단계적으로 진행.
- 진행 시 시작점: `media-server/`를 `backend/`로 리네임 + admin 라우트 골격 + admin 인증 분리.

## 참고: 현재 보안 구조

- `app/_layout.tsx` `RootGuard` — 클라이언트 라우트 가드 (1차 방어)
- Supabase RLS 78개 정책 — DB 레벨 enforce (2차 방어, 우회 불가)
- Storage RLS — `dive-media`, `avatars` 버킷
- Media server — Supabase JWT 검증 → upload-token 발급 (NAS 측 인증)
