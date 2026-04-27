# Supabase

DiveLog 백엔드. PostgreSQL + Auth + Storage + Realtime.

## 처음 셋업 (한 번만)

1. https://supabase.com 에서 프로젝트 생성
2. Project Settings → API → URL과 anon key 복사
3. `mobile/.env`에 입력:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
   ```
4. SQL Editor에서 `migrations/001_initial_schema.sql` 실행
5. Storage에서 `dive-media`, `avatars` 버킷 생성 (public)
6. Auth → Providers에서 Google/Kakao/Apple 활성화

## 타입 자동 생성 (스키마 변경 후)

```bash
npx supabase gen types typescript --project-id <id> > mobile/src/types/database.ts
```

## 마이그레이션 추가

새 마이그레이션은 `migrations/00X_description.sql` 형식으로 추가하고
SQL Editor에 직접 붙여넣어 실행. 추후 `supabase` CLI 도입 시 `db push`로 일괄 적용.
