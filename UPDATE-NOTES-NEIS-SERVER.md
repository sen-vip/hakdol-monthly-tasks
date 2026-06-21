# NEIS 서버모드 적용 메모

이번 버전은 Vercel 백엔드 주소를 프론트에 반영한 버전입니다.

## 반영된 백엔드 주소

```txt
https://hakdol-neis-ffsg21bu9-senvip.vercel.app
```

## 확인할 것

- `index.html`에서 `neis-extension.css?v=20260621-server3` 연결
- `index.html`에서 `neis-extension.js?v=20260621-server3` 연결
- `neis-extension.js`에서 `API_MODE = 'server'`
- `neis-extension.js`에서 `SERVER_API_BASE = 'https://hakdol-neis-ffsg21bu9-senvip.vercel.app'`

## 테스트 순서

1. GitHub Pages 배포 후 강력 새로고침: `Ctrl + F5`
2. 학교명에 `한국` 입력
3. 서울특별시교육청 선택
4. 학교 찾기
5. 검색 결과에서 학교 선택
6. 1년 학사일정 불러오기

## 백엔드 단독 확인

```txt
https://hakdol-neis-ffsg21bu9-senvip.vercel.app/api/health
https://hakdol-neis-ffsg21bu9-senvip.vercel.app/api/schools?officeCode=B10&schoolName=한국
```
