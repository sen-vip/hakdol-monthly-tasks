# 프론트 서버모드 적용

이 폴더의 `neis-extension.js`와 `neis-extension.css`를 기존 `hakdol-monthly-tasks` 저장소 루트에 덮어씁니다.

그 다음 Vercel 백엔드 주소를 반영합니다.

```powershell
py set-backend-url.py https://내-vercel-주소.vercel.app
```

확인할 부분:

```js
const API_MODE = 'server';
const SERVER_API_BASE = 'https://내-vercel-주소.vercel.app';
```

이제 화면에서 나이스 API 인증키 입력칸이 사라지고, 사용자는 학교 검색만 하면 됩니다.
