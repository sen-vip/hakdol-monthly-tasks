# Vercel API 404 수정 메모

이번 버전은 Vercel에서 `/api/timetables`가 404로 뜨는 문제를 해결하기 위해 `api/` 폴더를 추가했습니다.

## 추가된 엔드포인트

- `/api/health`
- `/api/schools`
- `/api/schedules`
- `/api/timetables`

## 필요한 환경변수

Vercel Project Settings → Environment Variables

```txt
NEIS_API_KEY=나이스_인증키
```

환경변수 저장 후 반드시 Redeploy 해야 합니다.

## 테스트 주소

```txt
https://hakdol-monthly-tasks.vercel.app/api/health
https://hakdol-monthly-tasks.vercel.app/api/timetables
```

`/api/timetables`를 파라미터 없이 열면 안내 JSON이 뜨는 것이 정상입니다.
캘린더에서는 학교 선택 후 officeCode, schoolCode, year, month가 자동으로 붙어 호출됩니다.
