# NAS 셋업 가이드 — DS220+ + Cloudflare Tunnel

DiveLog 미디어 서버를 Synology DS220+ 에 배포하는 단계별 가이드.
도메인은 `*.dooname.cloud`, Cloudflare Tunnel로 외부 노출, 인증은 Supabase JWT.

---

## 사전 준비물

- ✅ DS220+ (DSM 7.2+, **Container Manager** 패키지 설치됨)
- ✅ Supabase 프로젝트 (JWT Secret 확인 가능)
- ✅ Cloudflare 무료 계정
- ✅ 도메인 `dooname.cloud` 의 네임서버가 Cloudflare로 위임되어 있음

> 도메인 네임서버가 아직 Cloudflare가 아니라면 Cloudflare 대시보드에서
> "Add a site" → 무료 플랜 선택 → DNS 레코드 자동 import → 표시된 NS 2개를
> 도메인 등록업체(가비아 등)에서 변경. 전파에 5분~24시간.

---

## Phase 1 — Cloudflare Tunnel 만들기 (대시보드, 10분)

1. **Cloudflare 대시보드** 접속 → 좌측 메뉴 **Zero Trust** 클릭
2. (처음이면) Zero Trust 팀 이름 설정 + Free 플랜 선택
3. 좌측 **Networks → Tunnels** → **Create a tunnel**
4. Connector type: **Cloudflared** 선택
5. Tunnel name: `divelog-nas` → **Save tunnel**
6. **"Install and run a connector"** 화면이 뜸 — **Docker** 탭 클릭
7. 표시된 명령어에서 **`--token` 뒤의 긴 문자열만 복사** (이게 `CLOUDFLARE_TUNNEL_TOKEN`)
8. **Next** → Public Hostname 추가:
   - Subdomain: `media`
   - Domain: `dooname.cloud`
   - Service Type: `HTTP`
   - URL: `media-server:3000`  ← Docker 내부 서비스 이름
9. **Save tunnel**

이 시점에서 `https://media.dooname.cloud` DNS는 Cloudflare에 자동 등록됨.

---

## Phase 2 — Supabase JWT Secret 가져오기 (1분)

1. Supabase 대시보드 → **Project Settings → API**
2. 페이지 하단 **JWT Settings** 섹션 → **JWT Secret** 복사 (긴 hex 문자열)
3. ⚠️ 이 값은 **anon key와 다른 비밀**입니다. 절대 클라이언트에 노출 금지.

---

## Phase 3 — NAS에 코드 배포 (15분)

### 3-1. SSH 접속 활성화 (한 번만)
DSM → Control Panel → Terminal & SNMP → **Enable SSH service** → Apply

### 3-2. Docker 폴더 생성 + 코드 업로드
DSM File Station에서:
```
/volume1/docker/divelog/      ← 만들기
/volume1/divelog-media/        ← 만들기 (실제 미디어 저장될 곳)
```

`media-server/` 폴더 전체를 `/volume1/docker/divelog/` 로 업로드 (File Station 또는 SSH).

또는 Git이 있으면 SSH로:
```bash
ssh admin@<nas-ip>
cd /volume1/docker
git clone <your-repo-url> divelog-repo
ln -s /volume1/docker/divelog-repo/media-server /volume1/docker/divelog/media-server
```

### 3-3. `.env` 작성
```bash
ssh admin@<nas-ip>
cd /volume1/docker/divelog/media-server
cp .env.example .env
vi .env
```

채워넣을 값:
```env
PORT=3000
STORAGE_ROOT=/data
PUBLIC_BASE_URL=https://media.dooname.cloud
SUPABASE_JWT_SECRET=<Phase 2에서 복사한 값>
UPLOAD_HMAC_SECRET=<openssl rand -hex 32 결과>
UPLOAD_URL_TTL=900
MAX_UPLOAD_BYTES=2147483648
CLOUDFLARE_TUNNEL_TOKEN=<Phase 1-7에서 복사한 토큰>
```

> `UPLOAD_HMAC_SECRET` 생성: SSH에서 `openssl rand -hex 32` 한 번 실행해서 출력 그대로 붙여넣기.
> NAS에 openssl이 없으면 https://www.random.org/strings/ 에서 64자 hex 생성.

### 3-4. Container Manager로 실행

**DSM Container Manager** 열기 → **Project** → **Create**:

- Project name: `divelog-media`
- Path: `/volume1/docker/divelog/media-server`
- Source: `Use existing docker-compose.yml`
- **Build** + **Start** 체크 → **Next** → **Done**

또는 SSH로:
```bash
cd /volume1/docker/divelog/media-server
sudo docker compose up -d --build
sudo docker compose logs -f
```

로그에서 다음 두 줄을 확인:
```
media-server listening on :3000
... cloudflared INF Connection registered ...
```

---

## Phase 4 — 동작 확인 (5분)

### 4-1. 헬스체크
브라우저에서 `https://media.dooname.cloud/health` 접속.
JSON `{"ok":true}` 가 보이면 성공.

### 4-2. 업로드 테스트 (curl)

```bash
# 1) Supabase에 로그인하여 JWT 받기 (mobile 앱에서 콘솔에 찍거나, Supabase SQL에서 access_token 확인)
JWT="eyJ...<your-supabase-access-token>"

# 2) 업로드 토큰 받기
curl -X POST https://media.dooname.cloud/upload-token \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{"diveId":"test-dive-1","originalFilename":"test.mp4","contentType":"video/mp4"}'

# → {"uploadUrl":"https://media.dooname.cloud/upload/...?exp=...&sig=...", "finalUrl":"...","filename":"...","expiresAt":...}

# 3) 그 URL에 PUT
curl -X PUT "<uploadUrl>" --data-binary "@./somevideo.mp4"

# → {"ok":true,"url":"https://media.dooname.cloud/file/dives/test-dive-1/...","sizeBytes":...}

# 4) 그 URL을 브라우저에서 열어 영상 재생 확인
```

---

## Phase 5 — 운영 베스트 프랙티스

### 보안
- DSM admin 계정 비활성화, 새 관리자 다른 이름으로 + 2FA
- Control Panel → Security → Auto Block (5회 실패 → 차단)
- WebDAV/SMB 외부 노출 X (Cloudflare Tunnel만 외부 노출)
- 정기 DSM 업데이트 자동 적용 활성화

### 백업
- Hyper Backup 패키지 → `/volume1/divelog-media/` 를 야간 1회 외부 (DS918+ 또는 클라우드)로 백업
- DB는 Supabase가 알아서 (Pro 플랜 시 PITR)

### 모니터링
- Cloudflare 대시보드 → Analytics → 이상 트래픽 모니터
- DSM Resource Monitor 알림 설정 (CPU/RAM/디스크 80% 초과 시 메일)
- `docker compose logs -f media-server` 로 에러 추적

### 업데이트
NAS 코드 업데이트 시:
```bash
cd /volume1/docker/divelog/media-server
git pull       # 또는 새 파일 수동 업로드
docker compose up -d --build
```

---

## 트러블슈팅

| 증상 | 원인/해결 |
|------|-----------|
| cloudflared 로그 `failed to sufficiently increase receive buffer size` + `control stream encountered a failure` 반복 | NAS Docker에서 QUIC/UDP 버퍼 부족. cloudflared 명령에 `--protocol http2` 추가 (docker-compose.yml에 이미 반영됨). 직접 `docker run` 시: `tunnel --no-autoupdate --protocol http2 run --token ...` |
| `https://media.dooname.cloud` 가 502 | cloudflared가 media-server에 못 닿음 → Tunnel 라우팅 hostname을 `media-server:3000` 으로 (localhost X) |
| `JWT verify failed` | `.env`의 `SUPABASE_JWT_SECRET` 이 anon key가 아닌 **JWT Secret** 인지 확인 |
| `Invalid or expired signature` | 클라이언트가 받은 uploadUrl을 15분 내 사용했는지. 시계 차이 클 때도 발생 |
| 업로드 도중 끊김 | NAS 업로드 대역폭 한계 또는 `MAX_UPLOAD_BYTES` 초과 |
| Cloudflare가 100MB 이상 막음 | Free 플랜은 100MB body 제한. Pro($20/월) 또는 클라이언트 압축 강화 |

> ⚠️ **Cloudflare Free의 100MB request body 제한** — 압축 후 영상이 100MB 넘으면 Tunnel이 차단. 이 경우 옵션:
> - 클라이언트에서 비트레이트 더 낮추기 (`react-native-compressor`)
> - 청크 업로드 구현 (Tus protocol — 중장기)
> - Cloudflare Pro 업그레이드 ($20/월, 500MB)
> - Cloudflare Bypass: tunnel 대신 직접 NAS 노출 (보안 약화)
