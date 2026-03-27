# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WOOZOO** — 다이빙 로그북 커뮤니티 앱. 다이빙 컴퓨터에서 데이터를 추출·파싱·시각화하고, 커뮤니티 기능을 제공하는 것이 목표이다.

**현재 단계**: Shearwater Peregrine TX 다이브 컴퓨터에서 BLE로 다이브 로그를 추출하고 파싱하는 CLI 도구. libdivecomputer C 라이브러리의 Shearwater 프로토콜을 Python `bleak`으로 직접 구현 (libdivecomputer의 Windows BLE 지원이 불완전하기 때문).

**WOOZOO 특화 기능** (향후 구현 예정):
- 다이빙컴퓨터 데이터 기반 기록 자동화 (Shearwater → Garmin → Suunto 순)
- 모바일 앨범 연동으로 다이빙 사진/영상 자동 동기화
- 배경 및 기록에 다꾸(다이어리 꾸미기) 기능
- 다이빙 샵/기기 인증을 통한 데이터 순수성 보장 (실물 로그북 대안)
- 데이터 기반 통계, 커뮤니티 공유, Q&A

## Dependencies

- **libdivecomputer/** (필수) — 프로토콜 참조용 C 라이브러리. Python 코드가 이 라이브러리의 Shearwater 프로토콜 로직을 포팅한 것이다.
- **Python**: `bleak` (BLE 통신), `plotly` (HTML 시각화에 CDN 사용)

```bash
pip install bleak
```

## Commands

```bash
# 최신 다이브 1개 다운로드
python logbook/downloader/shearwater_download.py

# 전체 다이브 다운로드
python logbook/downloader/shearwater_download.py --all

# 출력 디렉토리 지정 (기본: logbook/data/raw)
python logbook/downloader/shearwater_download.py --all --output /path/to/dir

# BLE 스캔 타임아웃 조정 (기본 30초)
python logbook/downloader/shearwater_download.py --timeout 60

# 주변 BLE 장치 스캔 (디버깅용)
python logbook/downloader/ble_scan.py

# 다이브 로그 파싱 & 리포트 생성
python logbook/parser/parse_dive_logs.py

# 입력/출력 디렉토리 지정 (기본: logbook/data/raw → logbook/data/reports)
python logbook/parser/parse_dive_logs.py --logbook-dir /path/to/raw --output-dir /path/to/reports
```

## Architecture

```
logbook/
├── downloader/                 # BLE 통신 & 다운로드
│   ├── shearwater_download.py  # BLE 다운로더 (4-layer 프로토콜 스택)
│   └── ble_scan.py             # BLE 디바이스 스캐너 (디버깅용)
├── parser/                     # 바이너리 파싱 & 리포트 생성
│   └── parse_dive_logs.py      # Petrel Native Format 파서 → JSON/MD/HTML
└── data/                       # 출력 데이터 (gitignore 대상)
    ├── raw/                    # 다운로드된 원본 다이브 데이터
    └── reports/                # 파싱 결과 리포트
```

**shearwater_download.py 프로토콜 레이어**:
```
[Main Workflow]  스캔 → 연결 → 장치정보 → manifest → 다이브 다운로드 → 저장
       |
[ShearwaterBLE]  connect/rdbi/wdbi/download/close — 장치 통신 클래스
       |
[Packet Layer]   build_request/parse_response — [0xFF,0x01,len,0x00,payload] 구조
       |
[SLIP + BLE]     slip_encode_ble/slip_decode — SLIP 프레이밍 + 32바이트 BLE 청킹
```

**libdivecomputer 참조 관계** (프로토콜 변경/디버깅 시 참조):
- `libdivecomputer/src/shearwater_common.c` — SLIP 프레이밍, transfer, download, LRE/XOR 압축해제
- `libdivecomputer/src/shearwater_petrel.c` — manifest 파싱, dive foreach, close, base_addr 매핑
- `libdivecomputer/src/shearwater_common.h` — 프로토콜 상수 (ID_SERIAL, ID_FIRMWARE 등)

## Shearwater BLE Protocol

**BLE 연결**:
- Service UUID: `fe25c237-0ece-443c-b0aa-e02033e7029d`
- Characteristic UUID: `27b7570b-359e-45a3-91bb-cf7e70049bd2` (write-without-response + notify)
- 장치 BLE 이름: "Peregrine" (TX 모델도 "Peregrine"으로 광고)

**SLIP over BLE**: 각 프레임은 32바이트 — 2바이트 헤더 `[nframes, counter]` + 최대 30바이트 SLIP payload. END=0xC0으로 패킷 종료. `nframes = (slip_len + 31) // 32`.

**명령 체계**: RDBI(0x22→0x62)로 데이터 읽기, WDBI(0x2E→0x6E)로 쓰기. 주요 ID: 0x8010(시리얼), 0x8011(펌웨어), 0x8050(하드웨어), 0x8021(로그업로드 정보).

**다운로드**: Init(0x35) → Block(0x36) 반복 → Quit(0x37). 다이브 데이터는 압축 전송(LRE 9bit RLE → XOR 32바이트 블록). Manifest는 비압축(주소 0xE0000000, 0x600바이트). block 번호는 unsigned char로 256에서 순환.

**종료**: WDBI ID=0x9020 data=0x00 전송 (응답 없음).

## Peregrine TX Connection

스크립트를 **먼저** 실행한 후 다이브 컴퓨터에서 Bluetooth를 활성화할 것 ("PC 대기" 모드가 빠르게 타임아웃됨):

1. Peregrine TX 전원 켜기
2. LEFT 버튼 반복 → "Bluetooth" 메뉴 이동
3. RIGHT 버튼으로 선택 → "PC 대기" 화면 진입
4. 스크립트가 자동으로 BLE 스캔 → 연결 → 다운로드

Windows 설정에서 클래식 BT 페어링이 등록되어 있으면 BLE 연결을 방해할 수 있으므로 제거 필요.

## Output Format

`logbook/data/raw/` 디렉토리에 저장:
- `device_info.txt` — 시리얼, 펌웨어, 하드웨어, base address
- `manifest.bin` — 원본 manifest 바이너리 (1536 bytes, 32바이트 레코드 × 48)
- `dive_{timestamp}.bin` — 압축 해제된 raw 다이브 데이터
- `dive_{timestamp}_fingerprint.bin` — 4바이트 fingerprint (Unix timestamp, big-endian)

Manifest 레코드 구조: header(offset 0, 2B: 0xA5C4=유효/0x5A23=삭제), fingerprint(offset 4, 4B), dive address(offset 20, 4B BE). 다이브 파일명의 숫자는 fingerprint를 uint32 BE로 읽은 값으로, Unix timestamp에 해당.

`logbook/data/reports/` 디렉토리에 생성:
- `dive_data.json` — 전체 다이브 데이터 구조화 JSON
- `dive_report.md` — Markdown 요약 리포트
- `dive_report.html` — Plotly.js 인터랙티브 시각화
