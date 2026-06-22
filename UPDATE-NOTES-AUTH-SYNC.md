# 학돌 월별필수업무 인증/저장 동기화 업데이트

## 반영 내용

- 회원가입 이메일 인증 리다이렉트 주소를 GitHub Pages 앱 주소로 지정
- 이메일 인증 후 앱으로 돌아오면 완료 안내 토스트 표시
- 인증 파라미터 처리 후 URL 정리
- 로그인 상태에서 학교 설정을 Supabase `user_school_settings`에 저장
- 로그인 상태에서 직접 추가한 우리 학교 일정을 Supabase `user_manual_events`에 저장
- 비로그인 상태에서는 기존처럼 localStorage 저장 유지
- 로그인 후 브라우저에만 있던 학교 설정/직접 추가 일정은 계정 저장으로 자동 이전
- 학교 설정 안내 문구를 로그인/비로그인 상태에 따라 다르게 표시
- 설정 초기화 시 직접 추가 일정은 유지하고 학교 설정/일정 캐시만 초기화

## Supabase에서 추가로 해야 할 일

1. `supabase-schema.sql`을 Supabase SQL Editor에서 다시 실행
2. Authentication → URL Configuration 설정

권장 설정:

```txt
Site URL:
https://sen-vip.github.io/hakdol-monthly-tasks/

Redirect URLs:
https://sen-vip.github.io/hakdol-monthly-tasks/
https://sen-vip.github.io/hakdol-monthly-tasks/**
https://hakdol-monthly-tasks.vercel.app/
https://hakdol-monthly-tasks.vercel.app/**
```

## 저장 기준

- 비로그인: 현재 브라우저 localStorage
- 로그인: Supabase 계정 저장 + localStorage 백업

## 주의

직접 추가 일정과 학교 설정 저장이 계정 단위로 동작하려면 Supabase의 RLS 정책과 테이블이 먼저 준비되어 있어야 합니다.
