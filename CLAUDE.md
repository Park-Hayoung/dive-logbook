# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WOOZOO / DiveLog** — 다이빙 로그북 + SNS 커뮤니티 모바일 앱.

- **핵심 가치 1**: 다이브 컴퓨터 BLE 연동으로 자동 기록 + 위변조 방지 (실물 로그북 대체)
- **핵심 가치 2**: 다이버 커뮤니티 — 피드/Q&A/팔로우/팀/샵 예약

## Tech Stack

| Layer       | Choice                                          |
|-------------|-------------------------------------------------|
| Frontend    | React Native + Expo SDK 54 (New Architecture)   |
| Routing     | Expo Router v6 (파일 기반, typed routes)         |
| Styling     | NativeWind v4 (Tailwind for RN)                 |
| State       | Zustand (전역) + TanStack Query (서버)           |
| Icons       | lucide-react-native                             |
| Backend     | Supabase (PostgreSQL + Auth + Storage)          |
| Media       | Synology NAS (DS220+) + Cloudflare Tunnel       |
| BLE         | react-native-ble-plx (Shearwater 통신)          |
| Language    | TypeScript                                      |
| Platforms   | iOS, Android (모바일 전용 — web 비활성)          |

## Repository Layout

```
woozoo_dive_project/
├── mobile/              # ★ 메인: React Native (Expo) 앱
│   ├── app/             # Expo Router 파일 기반 라우트
│   │   ├── (auth)/      # 로그인 + 온보딩 스택
│   │   ├── (tabs)/      # 5개 메인 탭 (홈/피드/로그북/프로필)
│   │   ├── log/         # /log/new, /log/[id]
│   │   └── shop/        # /shop/search, /shop/[id]
│   ├── src/
│   │   ├── components/  # 재사용 UI (StatBox, LogCard 등)
│   │   ├── services/
│   │   │   ├── ble/     # Shearwater BLE 클라이언트 (Python에서 포팅)
│   │   │   ├── supabase.ts
│   │   │   └── storage.ts
│   │   ├── hooks/       # TanStack Query 훅 (use-dives 등)
│   │   ├── store/       # Zustand (auth-store)
│   │   ├── types/       # 타입 정의 (database.ts는 Supabase 자동 생성)
│   │   └── lib/         # 포맷터, 컬러, query-client
│   ├── app.json         # Expo 설정 (BLE/사진 권한 + ble-plx 플러그인)
│   ├── tailwind.config.js
│   ├── global.css
│   └── .env             # Supabase URL/Key (gitignore)
│
├── supabase/            # DB 마이그레이션
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   └── 002_media_provider.sql
│   └── README.md
│
├── media-server/        # NAS Hono 업로드 서버 (Docker 배포)
│   ├── src/             #   index.ts, auth.ts, storage.ts, config.ts
│   ├── Dockerfile
│   ├── docker-compose.yml  # media-server + cloudflared 사이드카
│   └── README.md
│
├── docs/
│   └── nas-setup-guide.md  # DS220+ + Cloudflare Tunnel 셋업 가이드
│
├── logbook/             # ⚙️ Python BLE 도구 (RN 포팅의 레퍼런스)
│   ├── downloader/      #   Shearwater BLE 다운로더 (bleak 기반)
│   ├── parser/          #   Petrel Native Format 파서 → JSON/MD/HTML
│   └── data/            #   raw/, reports/ (gitignore)
│
├── libdivecomputer/     # C 라이브러리 — 프로토콜 참조용 (수정 X)
├── DiveLogApp.jsx       # Gemini 시안 (참조용 보존)
└── 요구사항명세서.txt
```

## Commands

### Mobile (RN 앱)
```bash
cd mobile

# 개발 서버 시작 (Expo Go에서 QR 스캔)
npm run start

# 플랫폼별 직접 실행
npm run ios       # iOS 시뮬레이터 (macOS만)
npm run android   # Android 에뮬레이터

# 타입 체크 / 린트
npm run typecheck
npm run lint

# 네이티브 빌드 (BLE 등 네이티브 모듈 포함 시)
# Expo Go로는 BLE 테스트 불가 → EAS Build 또는 prebuild + native build 필요
npx expo prebuild
npx expo run:ios
npx expo run:android
```

### Supabase
```bash
# 새 Supabase 프로젝트 셋업: supabase/README.md 참조
# 스키마 적용 후 타입 생성:
npx supabase gen types typescript --project-id <id> > mobile/src/types/database.ts
```

### Python (레퍼런스 / 디버깅용)
```bash
# Shearwater BLE 다운로드 (개발자 디버깅 — 모바일 BLE 미작동 시)
python logbook/downloader/shearwater_download.py --all

# 다이브 로그 파싱 & 리포트
python logbook/parser/parse_dive_logs.py
```

## Development Workflow

1. **Supabase 프로젝트 생성** → `mobile/.env`에 URL/Key 입력
2. **`supabase/migrations/001_initial_schema.sql`** SQL Editor에서 실행
3. **Storage 버킷** `dive-media`, `avatars` 생성 (public)
4. **`cd mobile && npm start`** → Expo Go로 첫 화면 확인
5. **BLE 기능 테스트**: Expo Go에서는 `react-native-ble-plx` 미작동 → EAS Build 또는 `npx expo run:android`로 네이티브 빌드 필요

## Key Architecture Notes

### BLE: Python → TypeScript 포팅 진행 중
`mobile/src/services/ble/` 가 `logbook/downloader/shearwater_download.py` 의 TS 포팅:
- ✅ `constants.ts` — UUID, 명령어, 매니페스트 상수 (포팅 완료)
- ✅ `slip.ts` — SLIP 인코딩/디코딩 + BLE 청킹 (포팅 완료)
- ⏳ `packet.ts` — 패킷 헤더 (스켈레톤만)
- ⏳ `decompress.ts` — LRE + XOR 디컴프레션 (TODO)
- ⏳ `shearwater.ts` — `BleManager` 통합 메인 클래스 (스켈레톤)

**프로토콜 변경/디버깅 시 참조 순서**:
1. `mobile/src/services/ble/` — 현재 구현
2. `logbook/downloader/shearwater_download.py` — 검증된 Python 원본
3. `libdivecomputer/src/shearwater_common.{c,h}`, `shearwater_petrel.c` — 원조 C 구현

### Auth Flow
- `app/_layout.tsx` 의 `RootGuard` 가 라우트 가드 + 세션 복구 담당
  - 미인증 → `/(auth)/login` 으로 redirect
  - 세션 있으나 프로필 미생성 → `/(auth)/onboarding`
  - 세션+프로필 있는데 auth 그룹에 있음 → `/(tabs)` 로 바운스
  - 프로필 fetch 에러일 땐 onboarding으로 튕기지 않음 (네트워크 에러 분리)
- `app/(auth)/login.tsx` 에서 카카오/구글/애플 OAuth (Supabase Auth)
- `signOut` 시 TanStack Query 캐시 전체 clear → 계정 전환 시 이전 사용자 데이터 잠깐 노출 방지
- DB 레벨 RLS도 깔려 있어서 (78개 정책) 클라이언트 가드 우회되더라도 백엔드에서 거부

### Data Flow (다이브 기록)
```
Shearwater 다이브 컴퓨터
  ↓ BLE (react-native-ble-plx)
mobile/src/services/ble/shearwater.ts
  ↓ 파싱 (binary → Dive 객체)
mobile/src/hooks/use-dives.ts
  ↓ INSERT
Supabase (dives + dive_media + dive_buddies + dive_equipment)
  ↓ SELECT
mobile/app/(tabs)/logbook.tsx (LogCard 리스트)
  ↓ tap
mobile/app/log/[id].tsx (상세 뷰어)
```

### Mobile-Only 정책
`app.json`에 `"platforms": ["ios", "android"]` — 웹 빌드 비활성. EXIF 자동 매칭 대신 **사용자가 갤러리에서 수동 업로드** (`expo-image-picker` → 미디어 스토리지).

### Media Storage Architecture
사진/영상은 Supabase Storage가 아닌 **Synology NAS + Cloudflare Tunnel**로 저장. 영상은 4K가 흔해 Supabase 1GB 무료 한도를 즉시 초과하기 때문.

```
[RN App]
  ├ expo-image-picker → react-native-compressor (1080p H.264 ~30MB/min)
  ├ POST /upload-token (Supabase JWT) → media-server (NAS)
  └ PUT signed URL → 파일 저장 → finalUrl 받음 → dive_media INSERT
```

- `mobile/src/services/media-storage/` — provider 추상화 (`MediaStorage` 인터페이스)
- `mobile/src/services/video-compression.ts` — 클라이언트 압축
- `media-server/` — Hono + jose, NAS Docker로 배포 (cloudflared 사이드카)
- `dive_media.provider` 컬럼으로 추적 → Cloudflare R2/Stream 마이그레이션 시 클래스만 교체

### Commands (media-server)
```bash
cd media-server
npm install && npm run dev      # 로컬 개발
npm run typecheck

# NAS 배포: docs/nas-setup-guide.md 참조
docker compose up -d --build
```

## Shearwater BLE Protocol (참조)

**BLE 연결**:
- Service UUID: `fe25c237-0ece-443c-b0aa-e02033e7029d`
- Characteristic UUID: `27b7570b-359e-45a3-91bb-cf7e70049bd2` (write-without-response + notify)
- 장치 BLE 이름: "Peregrine" (TX 모델도 "Peregrine"으로 광고)

**SLIP over BLE**: 각 프레임 32바이트 — 2바이트 헤더 `[nframes, counter]` + 최대 30바이트 SLIP payload. END=0xC0으로 종료. `nframes = ceil(slip_len / 30)`.

**명령**: RDBI(0x22→0x62) 읽기, WDBI(0x2E→0x6E) 쓰기. 주요 ID: 0x8010(시리얼), 0x8011(펌웨어), 0x8050(하드웨어), 0x8021(로그업로드 정보).

**다운로드**: Init(0x35) → Block(0x36)×N → Quit(0x37). 다이브 데이터는 LRE 9bit RLE → XOR 32바이트 블록 압축. Manifest는 비압축 (주소 0xE0000000, 0x600바이트). block 번호는 256 순환.

**종료**: WDBI ID=0x9020 data=0x00 (응답 없음).

**Manifest 레코드 (32B)**: header(0, 2B: 0xA5C4=유효/0x5A23=삭제), fingerprint(4, 4B BE = Unix timestamp), dive address(20, 4B BE).

## Peregrine TX 연결 절차 (테스트용)

스크립트(또는 RN 앱)를 **먼저** 시작한 뒤 다이브 컴퓨터에서 Bluetooth 활성화 ("PC 대기" 모드가 빠르게 타임아웃됨):

1. Peregrine TX 전원 켜기
2. LEFT 반복 → "Bluetooth" 메뉴 이동
3. RIGHT 선택 → "PC 대기" 진입
4. 스크립트/앱이 자동으로 스캔 → 연결 → 다운로드

Windows 설정에서 클래식 BT 페어링이 등록되어 있으면 BLE를 방해 — 제거 필요.
