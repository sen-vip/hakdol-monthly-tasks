# NEIS 시간표 감지 일정 보완 업데이트

이번 버전은 기존 학사일정 API에 더해 시간표 API 기반의 행사성 일정을 캘린더에 함께 표시하도록 프론트 코드를 보완한 버전입니다.

## 반영 내용

- 기존 학사일정 API 일정 유지
- 시간표 API 수업내용 중 아래 키워드가 포함된 항목만 캘린더 일정으로 변환
  - 수련활동, 수련회, 체험학습, 현장체험학습, 수학여행, 진로체험, 직업체험, 봉사활동, 창체, 자율활동, 동아리, 스포츠클럽, 행사, 축제 등
- 같은 날짜와 같은 수업내용은 하나로 병합
- 병합된 시간표 일정에 학년/반 정보 보관
- 캘린더에서 `학사일정` / `시간표 감지` 출처 구분
- 시간표 일정은 학교+월 단위로 24시간 캐싱
- 월 이동 시 해당 월 시간표 감지 일정 자동 확인
- 기존 화면이 깨지지 않도록 시간표 API 실패 시 학사일정만 표시

## 백엔드 확인 필요

현재 프론트는 서버 모드입니다.

```js
const API_MODE = 'server';
const SERVER_API_BASE = 'https://hakdol-neis-api.vercel.app';
```

따라서 시간표 일정까지 실제로 불러오려면 Vercel 백엔드에 아래 엔드포인트가 필요합니다.

```txt
GET /api/timetables
```

프론트가 전달하는 주요 파라미터는 아래와 같습니다.

```txt
officeCode
schoolCode
schoolKind
rootName      // elsTimetable, misTimetable, hisTimetable 중 하나
year
month
pageSize
```

응답은 아래 중 하나의 배열 필드로 내려오면 됩니다.

```js
{
  rows: []
}
```

또는

```js
{
  timetables: []
}
```

프론트는 `/api/timetables`를 먼저 시도하고, 실패하면 `/api/timetable`도 한 번 더 시도합니다.

## 데이터 과다 호출 방지 원칙

- 시간표는 전교 전체를 한 번에 불러오는 용도가 아닙니다.
- 현재 보고 있는 월만 조회합니다.
- pSize는 300 기준입니다.
- 하루 데이터가 300건을 넘을 경우 페이징으로 나누는 구조를 권장합니다.
- 프론트 캐싱은 `hakdolNeisTimetables_연도_월_교육청코드_학교코드` 키를 사용합니다.

## 수정 파일

- `neis-extension.js`
- `neis-extension.css`
- `index.html` 캐시버스터 버전값 변경
