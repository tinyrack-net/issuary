# API 보안 진단 및 개선 기록

진단일: 2026-09-10. 대상: Issuary의 실행 시 등록된 HTTP 메서드·경로 81개와 연결된 프런트엔드. 로컬 SQLite, 격리 PostgreSQL, 모의 외부 인증 제공자만 사용했다. 운영 환경·예제 앱·운영 인프라는 검사하지 않았다.

## 결과와 판정 기준

복사된 세션 쿠키의 폐기 불가, TOTP 재사용, 비밀번호 재설정 실패 시 토큰 소모, 이메일 인증 뒤 기존 MFA 생략, 이메일 재전송 계정 열거, 복귀 경로의 브라우저 정규화 우회를 수정했다. 서버 측 세션 만료와 일회성 값의 DB 조건부 소비, 인증 시도 제한도 추가했다. 후속 R1~R5에서는 사용자 단위 인증수단 트랜잭션, 영속 OAuth grant, 설정 사용자 폐기, 암호화된 이메일 큐와 엄격한 입력 파싱을 구현했다. 로컬 HTTPS 교차 사이트 Apple 방식 callback도 검증했다. 아래의 **수정**은 해당 문제에 대한 조치이며 API 전체의 무결함 판정이 아니다. **기존 검증**은 명시된 경계와 기존 테스트 범위에 한정된다. **추가 확인**은 악용이 재현되지 않았거나 환경별 실험이 남은 부분이다.

계획 당시 `GET /api/user/session`의 HTTP 200만으로 판단한 재현은 불충분했다. 이 API는 비로그인에도 `200 {user:null}`을 반환한다. 실제로 인증을 요구하는 `GET /api/user/oauth-accounts`에 이전 쿠키를 보내 수정 전 200, 수정 후 401임을 확인했다. 세션 저장소 적용을 일시적으로 제거한 대조 실행에서 로그아웃·OIDC 로그아웃·비밀번호 재설정 회귀 테스트가 실패했다.

프로토콜 기준은 [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html), OTP의 일회성과 온라인 추측 제한 기준은 [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)이다. 이는 전체 표준 준수 인증이 아니다. 구형 implicit/ID-token 기능이 광고되는 경우의 정책 정리는 실제 인증 우회와 별도로 다룬다.

## 문제별 수정 명세와 재현

| ID·우선순위 | 원인·공격 전제와 재현 | 수정 위치·완료 조건 |
| --- | --- | --- |
| S1 · P0 · 수정 | 공격자가 로그인 쿠키를 복사한다. 원래 브라우저에서 로그아웃 또는 비밀번호 재설정 후 보호 API에 복사본 전송 시 기존에는 인증 유지. 삭제 후 복원된 사용자도 주체의 폐기 세대가 없었다. | `middleware/session.ts`, `services/browser-session.service.ts`, `services/password-auth.service.ts`, `services/user.service.ts`, `routes/oauth/end-session/get.ts`. 쿠키는 암호화된 SID만 보관, DB 세션 조회·만료·revision CAS 적용. 로그아웃은 해당 브라우저의 전체 계정 세션 삭제. 비밀번호 변경/제거/재설정 및 사용자 삭제·민감 속성 변경은 사용자별 폐기 시각과 토큰 세대 갱신. 복사 쿠키 401, 오래된 요청의 저장으로 세션 부활 불가, 정상 로그인 가능. |
| S2 · P1 · 수정 | 유효한 6자리 TOTP를 동일 시간 구간에 다른 요청에서 재사용. 기존 `verifySync`는 이미 사용한 시간 구간을 저장하지 않았다. 순차·동시 재사용 테스트가 수정 전 실패했다. | `services/totp.service.ts`, `entities/user-totp.entity.ts`. `last_used_step < accepted_step` 조건의 원자적 UPDATE. 로그인·설정 검증·해제·복구 코드 재발급에 공통 적용. 독립 DB 컨텍스트에서 성공은 정확히 하나. |
| S3 · P1 · 수정/방어 강화 | 복구 코드·이메일/재설정 토큰을 읽고 나중에 사용 표시하는 구조는 경쟁 창을 남긴다. 유효 재설정 토큰과 정책 미달 비밀번호를 보내면 토큰이 먼저 소모되는 문제는 실패 테스트로 확인. | 두 토큰 repository와 `password-reset.service.ts`, `email.service.ts`, TOTP 서비스. 사용 전 상태·DB 만료 조건을 포함한 원자적 소비. 토큰 소비와 비밀번호/이메일 변경은 트랜잭션. 독립 컨텍스트 동시 요청 성공 하나, 잘못된 비밀번호 후 같은 토큰으로 정상 재설정 성공. 이전 구현의 모든 DB 경쟁 결과를 실험으로 입증한 것은 아니므로 구조상 결함과 실험을 구분한다. |
| S4 · P0 · 수정 | 이메일 인증 성공 시 이미 등록된 TOTP가 있는 사용자에게 완전한 로그인 세션을 설정할 수 있었다. 기존 MFA가 있는 미인증 이메일 사용자의 토큰을 소비하는 회귀 시나리오로 검사. | `routes/api/auth/email/verify/post.ts`, 프런트엔드 `_auth.verify.email`. 등록된 2FA를 먼저 확인하여 MFA 대기로 이동. 보호 API는 401, 응답은 기존 2FA 방식, 브라우저는 검증 화면으로 이동. |
| S5 · P1 · 수정 | 브라우저가 쿠키 만료를 따르지 않으면 서버가 자체 만료를 검사하지 못했다. 인증 대기와 WebAuthn/OAuth state에도 서버 측 시간 경계 필요. | DB 세션 절대 만료 24시간, MFA 대기·challenge·외부 OAuth state 10분. MFA 완료/주체 전환 시 SID 회전. OAuth `form_post` 보조 쿠키는 별도 kind의 SID이며 권한은 DB에서만 복원. 과거 보조 쿠키로 완료된 state 복원 불가. |
| S6 · P2 · 수정 | 이메일 재전송의 400/404 응답으로 가입·인증 상태가 구분되고 반복 인증/메일 요청 제한이 없었다. | `/email/resend`의 존재/인증 여부 응답을 동일한 200 메시지로 통일. 로그인·가입은 이메일별 20회/10분, 재설정 요청·재전송 각 3회/분, OTP는 사용자별 합산 10회/5분. 연결 peer를 식별할 수 있으면 민감 POST/PUT/DELETE에 IP당 600회/분 추가. DB 공유 fixed window, HMAC 키, 초과 429 + Retry-After. 로그인 성공 시 해당 실패 예산 초기화. 존재하지 않는/패스워드 없는 계정도 더미 해시 검증. 응답시간의 완전한 동일성은 보장하지 않는다. |
| S7 · P2 · 수정 | `/\\attacker`와 `/\t/attacker`를 상대 경로로 받으면 브라우저 정규화 뒤 외부 URL이 될 수 있다. 약관 화면의 redirect도 임의 문자열로 이동했다. 스키마 회귀 테스트에서 수정 전 허용을 확인했다. | `schemas/field.ts`, 프런트엔드 `libs/local-return-path.ts`, `_auth.terms`. URL 정규화 후 origin 확인, 역슬래시·CR/LF·프로토콜 상대 경로 차단. 프런트엔드 부적합 경로는 `/profile`. 정상 local path/query 보존. |
| S8 · P2 · 보강 | 민감 API 공통 캐시/입력 크기 정책 및 문서 누락. OpenAPI에 9개 경로가 없었고 관리자 16개 메서드의 인증 표시 누락. | 1 MiB 요청 본문 제한(413), no-store, no-referrer, nosniff, frame-ancestors. 공개 discovery의 명시적 캐싱은 유지. 관리자/문서/root discovery OpenAPI 보완. 실행 라우트·보고서·OpenAPI 일치 자동 검사. |

## 공통 검사 범위

- 인증/인가: 쿠키를 통한 주체, MFA 대기/설정 단계, DB의 활성 사용자·관리자 역할, 토큰의 client 및 사용자 세대를 검사했다. 관리자 모든 메서드의 비로그인/일반 사용자 경계를 자동 검사한다.
- 입력: 기존 Zod 스키마, JSON/form 파싱, redirect 검증에 본문 1 MiB 제한을 추가했다. 모든 필드에 대해 유니코드·중복 파라미터·배열 조합 퍼징을 완료한 것은 아니다.
- CSRF/CORS: `/api/*`, `/oauth/device`의 기존 보호와 OAuth 프로토콜 예외를 검토했다. Hono의 HEAD는 GET 경계를 따르며 본문을 제거한다. OPTIONS의 허용 origin, OAuth CORS는 기존 회귀 테스트와 대장 테스트로 확인한다. HEAD/OPTIONS는 81개의 명시적 등록 항목에 중복 집계하지 않는다.
- 캐시/로그: 민감 기본 응답 no-store, SSR의 private/no-store 경계 확인. 요청 로거는 path만 기록하며 query/body/cookie를 기록하지 않고 tracing은 route/method/status 중심이다. 예상하지 못한 외부 라이브러리 오류의 exception 내용까지 모든 입력으로 입증하지는 않았다. 운영 수집기·프록시의 기록 정책은 범위 밖이다.
- 실패 부작용: 비밀번호 재설정은 토큰 소비와 변경을 원자화했다. TOTP/인증수단 제거의 복합 경쟁·장애 주입에 대한 잔여 검증은 아래 후속 작업으로 남긴다.

## API 대장

근거 경로는 저장소 기준이다. 각 행의 테스트는 검사한 동작의 근거이며 해당 API 전체를 완전 검증했다는 뜻은 아니다. 공통 검사 및 S1/S5/S6/S8은 적용되는 모든 행에 함께 적용된다.

| 메서드·경로 | 인증 경계 | 판정·진단 근거 | 코드/테스트 |
| --- | --- | --- | --- |
| `DELETE /api/admin/clients/:id` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `DELETE /api/admin/users/:sub` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `DELETE /api/oauth/:provider` | state/PKCE/공급자; 연결·해제는 로그인 | 수정 S5/S7: DB state 일회성·만료, 복귀 origin 검증. 기존 제공자/연결 주체/verified email 정책 검증. | [검증](../../packages/server/src/routes/api/oauth/_provider/delete.test.ts) |
| `DELETE /api/user` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S1: 자기 계정만 삭제, 복원해도 이전 세션/토큰 무효. 기존 삭제 정책 검증. | [검증](../../packages/server/src/routes/api/user/delete.test.ts) |
| `DELETE /api/user/passkeys/:id` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 소유자·challenge·origin/RP ID·설정 단계, S5 만료. R1: 활성 인증수단 정책과 사용자 DB 잠금 적용; 쌍별 독립 프로세스 검증. | [검증](../../packages/server/src/routes/api/user/passkeys/_id/delete.test.ts) |
| `DELETE /api/user/password` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S1: 비밀번호 변경/제거 시 기존 인증 폐기, 프런트엔드 재로그인. R1: 마지막 기본 인증수단 제거를 DB 트랜잭션에서 차단. | [검증](../../packages/server/src/routes/api/user/password/delete.test.ts) |
| `DELETE /api/user/totp` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S2/S5/S6: 일회성 코드·사용자 바인딩·만료. R1: 사용자 DB 잠금, OTP 소비·설정·복구 코드 교체의 원자성 검증. | [검증](../../packages/server/src/routes/api/user/totp/delete.test.ts) |
| `GET /.well-known/openid-configuration` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/.well-known/openid-configuration/get.test.ts) |
| `GET /api/admin/clients` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `GET /api/admin/me` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/admin-auth.test.ts) |
| `GET /api/admin/overview` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `GET /api/admin/search` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `GET /api/admin/system` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `GET /api/admin/terms` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `GET /api/admin/users` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `GET /api/admin/users/:sub` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `GET /api/auth/2fa/methods` | MFA 대기 | 수정 S5: 대기 상태의 서버 만료와 사용자 바인딩. | [검증](../../packages/server/src/routes/api/auth/2fa/methods/get.test.ts) |
| `GET /api/auth/accounts` | 브라우저에 기억된 주체/chooser | 수정 S1/S5: 폐기된 계정 제거, 허용 subject·chooser 연속성·TTL. 다른 계정 임의 선택 차단. | [검증](../../packages/server/src/routes/api/auth/accounts.test.ts) |
| `GET /api/config` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/config/get.test.ts) |
| `GET /api/consent` | 정상 사용자 | 기존 검증: client/redirect/scope 및 본인 동의, 강제 재인증 continuation. S1 세션 형식 적용. | [검증](../../packages/server/src/routes/api/consent/get.test.ts) |
| `GET /api/docs` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/docs/get.test.ts) |
| `GET /api/docs/json` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/docs/get.test.ts) |
| `GET /api/health` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/health/get.test.ts) |
| `GET /api/health/live` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/health/live/get.test.ts) |
| `GET /api/health/ready` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/api/health/ready/get.test.ts) |
| `GET /api/oauth/:provider/authorize` | state/PKCE/공급자; 연결·해제는 로그인 | 수정 S5/S7: DB state 일회성·만료, 복귀 origin 검증. 기존 제공자/연결 주체/verified email 정책 검증. | [검증](../../packages/server/src/routes/api/oauth/_provider/authorize/get.test.ts) |
| `GET /api/oauth/:provider/callback` | state/PKCE/공급자; 연결·해제는 로그인 | 수정 S5/S7: DB state 일회성·만료, 복귀 origin 검증. 기존 제공자/연결 주체/verified email 정책 검증. 모의 제공자 브라우저 검증; 실제 제공자 운영 설정은 범위 밖. | [검증](../../packages/server/src/routes/api/oauth/_provider/callback/get.test.ts) |
| `GET /api/oauth/authorization-context` | state/PKCE/공급자; 연결·해제는 로그인 | 수정 S5/S7: DB state 일회성·만료, 복귀 origin 검증. 기존 제공자/연결 주체/verified email 정책 검증. | [검증](../../packages/server/src/routes/api/oauth/authorization-context/get.test.ts) |
| `GET /api/terms` | 목록 공개 / 동의는 사용자 또는 설정 대기 | 기존 검증: 필수 약관·활성 버전/본인 동의. S7 프런트엔드 복귀 경로 제한. | [검증](../../packages/server/src/routes/api/terms/get.test.ts) |
| `GET /api/user/oauth-accounts` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 자기 계정의 연결 정보만 반환, 공급자 secret 제외. S1 폐기 회귀의 보호 API. | [검증](../../packages/server/src/routes/api/user/oauth-accounts/get.test.ts) |
| `GET /api/user/passkeys` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 소유자·challenge·origin/RP ID·설정 단계, S5 만료. R1: 활성 인증수단 정책과 사용자 DB 잠금 적용; 쌍별 독립 프로세스 검증. | [검증](../../packages/server/src/routes/api/user/passkeys/get.test.ts) |
| `GET /api/user/session` | 현재 브라우저 세션 / 로그아웃 hint 검증 | 수정 S1: 복사 쿠키 폐기·서버 만료. session 조회의 비로그인 응답은 200 user:null. | [검증](../../packages/server/src/routes/api/auth/security-regression.test.ts) |
| `GET /oauth/.well-known/jwks` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/oauth/.well-known/jwks/get.test.ts) |
| `GET /oauth/.well-known/openid-configuration` | 공개 | 기존 검증: 공개 필드/키만 반환, health 오류의 내부 정보 제한, docs 비활성화. S8 문서·헤더 보강. | [검증](../../packages/server/src/routes/oauth/.well-known/openid-configuration/get.test.ts) |
| `GET /oauth/authorize` | authorize: 사용자·동의 / token: client+grant | 기존 검증: 정확한 redirect, PKCE, scope/grant/client 경계, 코드·refresh 회전/재사용 폐기. S1 사용자 폐기 세대. R2: 영속 grant와 독립 서버의 코드·refresh 경합 검증. | [검증](../../packages/server/src/routes/oauth/authorize/get.test.ts) |
| `GET /oauth/device` | client / 승인·거절은 로그인 사용자 | 기존 검증: 사용자 코드·승인 대상·polling 간격·일회성 승인. S1 승인 이후 사용자 폐기. R2: 독립 서버의 device 소비·상태 전이 검증. | [검증](../../packages/server/src/routes/oauth/provider-compatibility.test.ts) |
| `GET /oauth/end_session` | 현재 브라우저 세션 / 로그아웃 hint 검증 | 수정 S1: 복사 쿠키 폐기·서버 만료. session 조회의 비로그인 응답은 200 user:null. | [검증](../../packages/server/src/routes/api/auth/security-regression.test.ts) |
| `GET /oauth/userinfo` | introspect/revoke: client / userinfo: access token | 기존 검증: client 소유권, 토큰 종류·서명·issuer·scope, 비활성 사용자/client. S1 사용자 토큰 세대. | [검증](../../packages/server/src/routes/oauth/userinfo/get.test.ts) |
| `PATCH /api/admin/clients/:id` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `PATCH /api/admin/terms/:id` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `PATCH /api/admin/users/:sub` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `PATCH /api/user/passkeys/:id` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 소유자·challenge·origin/RP ID·설정 단계, S5 만료. R1: 활성 인증수단 정책과 사용자 DB 잠금 적용; 쌍별 독립 프로세스 검증. | [검증](../../packages/server/src/routes/api/user/passkeys/_id/patch.test.ts) |
| `POST /api/admin/clients` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/clients/:id/restore` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/clients/:id/rotate-secret` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/clients/bulk-status` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/terms` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/terms/bulk-status` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/console/admin-console.test.ts) |
| `POST /api/admin/users` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `POST /api/admin/users/:sub/restore` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `POST /api/admin/users/bulk-status` | 관리자(매 요청 DB 역할) | 기존 검증: 비로그인 401·일반 사용자 403, 설정 관리 객체 보호·조회 필드 제한. S1/S8 반영. | [검증](../../packages/server/src/routes/api/admin/users/admin-users.test.ts) |
| `POST /api/auth/accounts/remove` | 브라우저에 기억된 주체/chooser | 수정 S1/S5: 폐기된 계정 제거, 허용 subject·chooser 연속성·TTL. 다른 계정 임의 선택 차단. | [검증](../../packages/server/src/routes/api/auth/accounts.test.ts) |
| `POST /api/auth/accounts/select` | 브라우저에 기억된 주체/chooser | 수정 S1/S5: 폐기된 계정 제거, 허용 subject·chooser 연속성·TTL. 다른 계정 임의 선택 차단. | [검증](../../packages/server/src/routes/api/auth/accounts.test.ts) |
| `POST /api/auth/email/resend` | 공개 | 수정 S6: 가입 여부 응답 통일, 주소별 발송 제한; SMTP 타이밍은 추가 확인. | [검증](../../packages/server/src/routes/api/auth/email/resend/post.test.ts) |
| `POST /api/auth/email/verify` | 유효 일회성 이메일 토큰 | 수정 S3/S4: 원자적 소비, 기존 MFA 생략 방지, 삭제 사용자 거절. | [검증](../../packages/server/src/routes/api/auth/email/verify/post.test.ts) |
| `POST /api/auth/login` | 공개 / 비밀번호·등록 정책 | 수정 S6: 이메일/발신원 예산 및 더미 해시. 기존 이메일·약관·MFA 정책 테스트. | [검증](../../packages/server/src/routes/api/auth/login/post.test.ts) |
| `POST /api/auth/logout` | 현재 브라우저 세션 / 로그아웃 hint 검증 | 수정 S1: 복사 쿠키 폐기·서버 만료. session 조회의 비로그인 응답은 200 user:null. | [검증](../../packages/server/src/routes/api/auth/security-regression.test.ts) |
| `POST /api/auth/passkey/options` | 공개 options / challenge + assertion | 수정 S5: challenge 만료·SID 회전. 기존 origin/RP ID/사용자 바인딩 및 서명 검증. | [검증](../../packages/server/src/routes/api/auth/passkey/options/post.test.ts) |
| `POST /api/auth/passkey/verify` | 공개 options / challenge + assertion | 수정 S5: challenge 만료·SID 회전. 기존 origin/RP ID/사용자 바인딩 및 서명 검증. | [검증](../../packages/server/src/routes/api/auth/passkey/verify/post.test.ts) |
| `POST /api/auth/password/forgot` | 공개 / reset은 일회성 토큰 | 수정 S1/S3/S6: 폐기·원자적 소비·실패 rollback·발송 제한. | [검증](../../packages/server/src/routes/api/auth/password/forgot/post.test.ts) |
| `POST /api/auth/password/reset` | 공개 / reset은 일회성 토큰 | 수정 S1/S3/S6: 폐기·원자적 소비·실패 rollback·발송 제한. | [검증](../../packages/server/src/routes/api/auth/password/reset/post.test.ts) |
| `POST /api/auth/register` | 공개 / 비밀번호·등록 정책 | 수정 S6: 이메일/발신원 예산 및 더미 해시. 기존 이메일·약관·MFA 정책 테스트. | [검증](../../packages/server/src/routes/api/auth/register/post.test.ts) |
| `POST /api/auth/totp/recovery/verify` | MFA 대기 | 수정 S2/S3/S5/S6: OTP·복구 코드 일회성, 대기 만료, 사용자별 시도 제한. | [검증](../../packages/server/src/routes/api/auth/totp/recovery/verify/post.test.ts) |
| `POST /api/auth/totp/verify` | MFA 대기 | 수정 S2/S3/S5/S6: OTP·복구 코드 일회성, 대기 만료, 사용자별 시도 제한. | [검증](../../packages/server/src/routes/api/auth/totp/verify/post.test.ts) |
| `POST /api/consent` | 정상 사용자 | 기존 검증: client/redirect/scope 및 본인 동의, 강제 재인증 continuation. S1 세션 형식 적용. | [검증](../../packages/server/src/routes/api/consent/post.test.ts) |
| `POST /api/oauth/:provider/callback` | state/PKCE/공급자; 연결·해제는 로그인 | 수정 S5/S7: DB state 일회성·만료, 복귀 origin 검증. 기존 제공자/연결 주체/verified email 정책 검증. 모의 제공자 브라우저 검증; 실제 제공자 운영 설정은 범위 밖. | [검증](../../packages/server/src/routes/api/oauth/_provider/callback/post.test.ts) |
| `POST /api/terms/consent` | 목록 공개 / 동의는 사용자 또는 설정 대기 | 기존 검증: 필수 약관·활성 버전/본인 동의. S7 프런트엔드 복귀 경로 제한. | [검증](../../packages/server/src/routes/api/terms/consent/post.test.ts) |
| `POST /api/user/passkeys/register/options` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 소유자·challenge·origin/RP ID·설정 단계, S5 만료. R1: 활성 인증수단 정책과 사용자 DB 잠금 적용; 쌍별 독립 프로세스 검증. | [검증](../../packages/server/src/routes/api/user/passkeys/register/options/post.test.ts) |
| `POST /api/user/passkeys/register/verify` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 기존 검증: 소유자·challenge·origin/RP ID·설정 단계, S5 만료. R1: 활성 인증수단 정책과 사용자 DB 잠금 적용; 쌍별 독립 프로세스 검증. | [검증](../../packages/server/src/routes/api/user/passkeys/register/verify/post.test.ts) |
| `POST /api/user/password` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S1: 비밀번호 변경/제거 시 기존 인증 폐기, 프런트엔드 재로그인. R1: 마지막 기본 인증수단 제거를 DB 트랜잭션에서 차단. | [검증](../../packages/server/src/routes/api/user/password/post.test.ts) |
| `POST /api/user/totp/confirm` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S2/S5/S6: 일회성 코드·사용자 바인딩·만료. R1: 사용자 DB 잠금, OTP 소비·설정·복구 코드 교체의 원자성 검증. | [검증](../../packages/server/src/routes/api/user/totp/confirm/post.test.ts) |
| `POST /api/user/totp/recovery/regenerate` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S2/S5/S6: 일회성 코드·사용자 바인딩·만료. R1: 사용자 DB 잠금, OTP 소비·설정·복구 코드 교체의 원자성 검증. | [검증](../../packages/server/src/routes/api/user/totp/recovery/regenerate/post.test.ts) |
| `POST /api/user/totp/setup` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S2/S5/S6: 일회성 코드·사용자 바인딩·만료. R1: 사용자 DB 잠금, OTP 소비·설정·복구 코드 교체의 원자성 검증. | [검증](../../packages/server/src/routes/api/user/totp/setup/post.test.ts) |
| `POST /api/user/totp/verify` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S2/S5/S6: 일회성 코드·사용자 바인딩·만료. R1: 사용자 DB 잠금, OTP 소비·설정·복구 코드 교체의 원자성 검증. | [검증](../../packages/server/src/routes/api/user/totp/verify/post.test.ts) |
| `POST /oauth/device` | client / 승인·거절은 로그인 사용자 | 기존 검증: 사용자 코드·승인 대상·polling 간격·일회성 승인. S1 승인 이후 사용자 폐기. R2: 독립 서버의 device 소비·상태 전이 검증. | [검증](../../packages/server/src/routes/oauth/provider-compatibility.test.ts) |
| `POST /oauth/device_authorization` | client / 승인·거절은 로그인 사용자 | 기존 검증: 사용자 코드·승인 대상·polling 간격·일회성 승인. S1 승인 이후 사용자 폐기. R2: 독립 서버의 device 소비·상태 전이 검증. | [검증](../../packages/server/src/routes/oauth/provider-compatibility.test.ts) |
| `POST /oauth/introspect` | introspect/revoke: client / userinfo: access token | 기존 검증: client 소유권, 토큰 종류·서명·issuer·scope, 비활성 사용자/client. S1 사용자 토큰 세대. | [검증](../../packages/server/src/routes/oauth/introspect/post.test.ts) |
| `POST /oauth/revoke` | introspect/revoke: client / userinfo: access token | 기존 검증: client 소유권, 토큰 종류·서명·issuer·scope, 비활성 사용자/client. S1 사용자 토큰 세대. | [검증](../../packages/server/src/routes/oauth/revoke/post.test.ts) |
| `POST /oauth/token` | authorize: 사용자·동의 / token: client+grant | 기존 검증: 정확한 redirect, PKCE, scope/grant/client 경계, 코드·refresh 회전/재사용 폐기. S1 사용자 폐기 세대. R2: 영속 grant와 독립 서버의 코드·refresh 경합 검증. | [검증](../../packages/server/src/routes/oauth/token/post.test.ts) |
| `POST /oauth/userinfo` | introspect/revoke: client / userinfo: access token | 기존 검증: client 소유권, 토큰 종류·서명·issuer·scope, 비활성 사용자/client. S1 사용자 토큰 세대. | [검증](../../packages/server/src/routes/oauth/userinfo/get.test.ts) |
| `PUT /api/user/password` | 정상 사용자; 등록 options/verify는 MFA 설정도 허용 | 수정 S1: 비밀번호 변경/제거 시 기존 인증 폐기, 프런트엔드 재로그인. R1: 마지막 기본 인증수단 제거를 DB 트랜잭션에서 차단. | [검증](../../packages/server/src/routes/api/user/password/put.test.ts) |

## DB/API 전환과 사용자 영향

- SQLite/PostgreSQL 각각 `Migration20260910120000_api_security` 적용: `browser_session`, `auth_budget`, `user.sessions_invalidated_at`, `user.token_epoch`, `user_totp.last_used_step`. 컴파일된 ORM 메타데이터와 마이그레이션 목록도 갱신한다. 서버의 기존 마이그레이션 실행 경로를 사용한다.
- 기존 자체 완결형 암호화 쿠키는 모두 무효다. 배포 시 모든 사용자가 다시 로그인하며 기억된 계정 선택 목록도 다시 채워진다. 한 사용자의 비밀번호 변경/재설정은 다른 브라우저를 포함한 그 사용자의 기존 인증을 폐기한다. 같은 브라우저에 기억된 다른 사용자의 인증은 사용자별로 유지한다. 명시적 로그아웃은 브라우저 전체 상태를 제거한다.
- 사용자 토큰 세대는 issuer의 userinfo/introspection/refresh 검증에 반영된다. 외부 RP가 JWT를 오프라인 검증하는 동안의 즉시 폐기까지 보장하지 않는다. access-token TTL/introspection 정책은 별도 RP 책임이다. 일반 로그아웃은 브라우저 세션만 폐기하며 OAuth grant 전체 철회와 같지 않다.
- TOTP는 같은 시간 구간에서 성공 후 재사용 불가하므로 다음 인증에는 새 코드가 필요하다. 대기 시간은 테스트에서 임의 sleep으로 넘기지 않고 가상 시계로 경계를 이동한다.
- 429/413은 새로운 공통 응답이다. 인증 화면의 에러 처리와 한국어·영어·일본어 메시지를 추가했다. 이메일 재전송 성공 문구는 가입 여부를 밝히지 않는다. 비밀번호 설정·변경·제거 성공 시 프런트엔드는 로그인으로 이동한다.
- 세션은 DB 가용성에 의존한다. 저장 충돌은 성공 인증으로 처리하지 않는다. 만료된 세션·시도 예산은 기존 cleanup scheduler의 security-state 작업으로 지운다. 롤백 시 구버전으로 내려가기 전에 신규 DB 테이블/컬럼 및 쿠키 형식 차이를 고려해야 하며, 구버전 복귀는 고친 폐기 결함을 다시 도입한다.

## R1~R5 후속 구현과 근거

| 항목 | 구현 결과 | 재현·검증 근거 |
| --- | --- | --- |
| R1 인증수단 경합 | `withUserSecurity`가 트랜잭션의 첫 DB 쓰기로 `user.security_revision`을 증가시킨 뒤 사용자·활성 인증수단을 다시 읽는다. 비밀번호 설정/변경/제거/재설정, TOTP 설정/검증/확정/해제/재발급, passkey 등록/제거, 명시적·자동 OAuth 연결/해제가 같은 경계를 사용한다. 마지막 기본 수단 및 필수 MFA의 마지막 등록 수단을 보존한다. | `security-mutation.test.ts`: 거절된 TOTP 해제 후 OTP 재사용 가능, 부분 변경·revision 롤백, 미완료 TOTP 재설정 시 이전 복구 코드 제거. `distributed-security.test.ts`: password/passkey/OAuth의 세 쌍, TOTP/passkey 필수 MFA, 동일 OTP의 복구 코드 재발급. 각 쌍은 두 서버 프로세스의 실제 HTTP 요청으로 검사한다. |
| R2 OAuth 분산 상태 | `oauth_grant`가 사용자·client·현재 refresh JTI·폐기·만료·revision을 보관한다. 코드의 redirect/PKCE 검증 이후 소비·grant 저장을 하나의 트랜잭션으로 커밋한다. refresh는 DB 잠금과 현재 JTI 비교로 회전하며, 재사용이면 해당 grant를 영속 폐기한다. 프로세스 내부 refresh 잠금을 제거했다. device polling의 재귀 재실행도 제거했다. | `grant-security.test.ts`: 잘못된 verifier는 코드를 소모하거나 이미 발급된 grant를 폐기하지 않는다. 정상 verifier로 사용한 코드를 재전송하면 기존 access token이 401이다. `distributed-security.test.ts`: code/refresh/device 소비는 정확히 1회 성공, 다른 서버의 userinfo도 폐기를 반영. 승인/거절은 배타적이다. |
| R3 설정 사용자 | plaintext 비밀번호를 기존 해시로 검증한다. 비밀번호·이메일·역할·삭제/복원 변경에만 폐기 시각과 token epoch를 갱신한다. 제거된 설정 사용자는 soft delete하고 동일 sub 재추가 시 새 세대를 부여한다. bootstrap DB 잠금, 동기화, 완료 fingerprint를 하나의 트랜잭션으로 처리한다. | `security-mutation.test.ts`: 역할/이메일/비밀번호 변경, 삭제·재추가, 변경 없는 해시 유지, 동기화 도중 실패 시 사용자와 fingerprint 롤백. 두 프로세스의 동일 설정 동기화는 기존 epoch를 유지한다. |
| R5 이메일 큐 | forgot/resend HTTP 요청은 계정을 조회하지 않고 동일한 암호화 작업을 `background_jobs`에 넣는다. 작업자가 계정·활성 상태·이메일 검증·설정 관리 여부를 검사한다. 등록 및 관리자 이메일 변경은 계정 변경과 enqueue를 함께 커밋한다. | `mail-queue.test.ts`: 존재/부재 주소 동일 응답 및 암호화 저장, HTTP 경로의 발송 부재, 지연 SMTP와 HTTP 응답 분리, 임시·영구 실패, 동일 토큰/Message-ID, lease 회수, 작업 종류 필터, 큐 실패 시 등록 롤백. 실제 claim 소유 프로세스를 SIGKILL한 뒤 다른 작업자가 복구하는 테스트도 포함한다. |
| R5 입력 | OAuth query/form 단일값 중복과 JSON의 중첩·escape 동치 키 중복을 파싱 단계에서 400으로 거절한다. 본문은 실제 스트림 바이트 기준 1 MiB 제한이다. | `strict-input.test.ts`: Content-Length 없음/거짓 길이의 스트리밍 초과, 중복 JSON 및 OAuth 파라미터. `api-inventory.test.ts`: seed 9700의 Unicode·제어문자·중복/인코딩 입력을 81개 메서드·경로에 적용. HTTP 어댑터의 과대 URL/헤더도 별도 검사. 임의의 모든 필드 조합을 망라한 증명은 아니다. |
| R4 로컬 HTTPS | localhost IdP와 127.0.0.1 모의 제공자를 서로 다른 사이트로 구성했다. `oauth_state`의 Secure/HttpOnly/SameSite=None, 로그인 세션의 Secure/HttpOnly/SameSite=Lax, form_post, callback 만료·재사용, SSR HTML/data 캐시 정책을 검사한다. | `local-https-security.test.ts`를 source 조건 Chromium에서 실행. 실제 Apple·스테이징·운영 프록시 및 RP의 오프라인 검증은 실행하지 않았다. |

수정 전 TOTP 해제 실패가 OTP를 소모하는 회귀와 미완료 설정 재시작 후 복구 코드가 남는 회귀를 확인했다. 중복 JSON/OAuth 파라미터 테스트도 파서 추가 전에 실패했다. 코드 재사용 폐기를 제거한 대조 변형은 userinfo가 200으로 남아 회귀 테스트를 실패시켰다. 이 대조 변형은 원본 과거 버전 전체를 실행했다는 뜻이 아니다. 마이그레이션에서는 30초 앞선 시각의 기존 브라우저 인증을 넣은 대조 테스트가 200으로 남는 것을 재현했고, 기존 세션의 명시적 삭제 후 401로 바뀌었다. 공유 SQLite 초기 경합에서 발생한 500은 제한된 DB 잠금 대기와 충돌 오류 매핑으로 해결했다. 테스트는 요청을 자동 재실행하거나 sleep으로 순서를 맞추지 않는다.

코드 재사용 정책은 [RFC 6749 §4.1.2](https://www.rfc-editor.org/rfc/rfc6749.html#section-4.1.2), refresh 회전 정책은 [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)을 따른다. 사용한 코드의 원래 유효기간이 끝나도 해당 grant의 토큰 수명이 남아 있으면 재사용 증거를 보관한다. grant 만료는 회전으로 짧아지지 않으며, 폐기된 grant도 토큰의 최대 수명 이전에는 정리하지 않는다. issuer의 userinfo/introspection/refresh 검증이 영속 상태를 확인한다.

### 응답·프런트엔드 변경

- 보안 변경의 DB 잠금/직렬화 충돌은 `409 CONCURRENT_SECURITY_CHANGE`이며 변경 요청을 자동 재실행하지 않는다. OpenAPI와 한·영·일 오류 문구를 추가했다. 비밀번호·TOTP·passkey·OAuth 연결 관리 화면에서 충돌을 표시하고 현재 설정을 확인하도록 한다.
- 이메일 요청은 기존의 일반화된 200을 유지한다. 큐 저장 실패는 500이며 성공으로 가장하지 않는다. 재전송 응답은 발송 예약 의미로 변경했다.
- 활성 passkey도 기본 로그인 수단으로 인정하므로 해당 사용자가 비밀번호를 제거할 수 있도록 프로필의 버튼 조건과 설명을 수정했다. TOTP만 남기는 제거는 거절한다.

### 이메일 작업의 수명과 운영 조건

메일 설정이 있으면 cleanup scheduler 설치 여부와 무관하게 작업자가 시작된다. poll 5초, lease 60초 및 30초 간격 갱신, 일시 실패 최대 3회, 재시도 간격 1초다. 5xx SMTP 영구 거절은 첫 실패에서 종료한다. 각 실행기는 등록된 작업 종류만 claim한다. 프로세스 종료는 만료된 lease를 통해 회수한다. 작업 ID·상태·attempt count·lease·완료 시각은 DB에서 확인할 수 있고, 발송 대기 시간, claim/lease 회수/재시도/완료/실패 상태와 정제된 오류 코드는 로그에 남긴다. 외부 모니터링 배포는 포함하지 않는다.

payload는 `hash_secret`에서 `mail-queue-v1` 용도로 파생한 별도 키로 암호화한다. 수신 주소나 토큰, 원문 SMTP 오류는 작업 로그에 쓰지 않는다. 완료/최종 실패 시 payload는 `null` 문자열로 대체한다. 재시도는 처음 준비한 토큰과 `<작업 UUID@issuer hostname>` Message-ID를 사용한다. 소비·만료·대체된 토큰은 보내지 않는다. 한 시간 이상 처리되지 않은 미준비 요청은 발송하지 않는다.

요청 접수 시각보다 늦게 생성/변경된 계정은 처리하지 않는다. 공개 요청의 동일 밀리초 생성/수정 경계는 보수적으로 거절한다. 등록/이메일 변경 작업은 해당 사용자 sub에 묶인다. `hash_secret` 회전은 이전 암호화 payload를 읽을 수 없게 하므로 메일 큐를 처리한 뒤 회전하거나 미처리 작업을 폐기하고 사용자가 새로 요청하도록 해야 한다. SMTP 수락 직후 프로세스가 종료되면 같은 Message-ID의 메일이 중복 발송될 수 있다. 정확히 한 번의 외부 SMTP 전달을 보장하지 않는다.

로컬 SQLite `app.request` 보조 측정은 주소별 1회 요청, 존재/부재 교대 순서, 그룹별 워밍업 10회 후 50회로 수행했다. 작업자는 멈춘 상태로 HTTP enqueue 경로만 측정했다. 존재 주소는 median 2.37 ms / p95 5.25 ms, 부재 주소는 median 2.50 ms / p95 6.78 ms였다. 이 값은 네트워크 또는 운영 부하의 동등성을 입증하지 않으며 통과 임계값으로 사용하지 않는다. 구조 검증은 HTTP 경로에서 계정 조회·SMTP 호출을 하지 않는 것과 지연 메일러 중 별도 HTTP 요청이 완료되는 것이다.

### DB 전환과 배포 절차

1. 같은 설정을 모든 인스턴스에 배포한다. 서로 다른 users/clients 설정을 동시에 동기화하는 운영은 지원하지 않는다.
2. SQLite/PG의 `Migration20260910160000_security_followup`을 적용한다. `security_revision`, `oauth_grant`, code/device의 `grant_id`와 ORM 메타데이터가 추가된다. 기존 browser_session 행을 삭제하여 시계 차이와 무관하게 쿠키 및 브라우저 대기 흐름을 폐기한다. 사용자 token epoch/세션 폐기 경계를 갱신하고 미완료 code/device 흐름을 만료시킨다. 사용자에게 재로그인을 안내한다. 이전 grant를 계속 허용하는 전환 경로는 두지 않는다.
3. 혼합 버전의 토큰 발급을 막기 위해 구버전 요청/작업자를 종료하고 마이그레이션 후 신버전을 시작한다. 쿠키에 기억된 계정도 인증 폐기의 영향을 받는다.
4. 양쪽 DB에서 migration down/up을 검사했다. down은 인증 폐기를 되돌리지 않는다. ORM schema 비교에서 이번 테이블/컬럼의 차이는 없어야 한다. 기존 background_jobs 제약 표현, unrelated index/comment, revoked_tokens FK의 baseline 차이는 이번 변경에서 자동 수정하지 않았다.
5. SQLite는 연결 초기화 시 최대 5초 DB busy 대기를 설정한다. 이는 요청 재실행이 아니며, 해결되지 않은 충돌은 실패 응답이다. 사용자 로그인과 큐의 저장/처리는 DB 가용성에 의존한다.

### 실제 환경 인수 점검표 — 미실행

| 확인 주체·대상 | 인수 절차와 합격 조건 |
| --- | --- |
| Apple/외부 IdP 담당자 | 실제 등록된 HTTPS callback, client/팀/key ID, redirect URI를 확인한다. 새 브라우저에서 form_post 로그인·연결을 완료하고 브라우저의 보조 쿠키 속성과 실제 전송을 확인한다. state/code 재사용·만료·다른 계정 연결 시 원래 주체 이외에 연결되지 않아야 한다. 테스트용 JWKS URL을 운영에 사용하지 않는다. |
| 프록시 담당자 | 신뢰 CIDR 또는 hop 수를 실제 토폴로지와 맞춘다. 신뢰하지 않는 소스에서 forwarding header를 위조해도 IP 제한 주체가 달라지지 않아야 한다. 각 홉의 IPv4/IPv6 주소, HTTPS origin, callback 경로를 확인한다. `trust_proxy=true`는 모든 직접 peer를 신뢰한다는 설정임을 검토한다. |
| 임베딩 담당자 | Hono 요청 환경에 실제 socket의 `incoming.socket.remoteAddress` 또는 `connInfo.remote.address`를 전달한다. HTTP 헤더를 실제 peer 정보로 복사하지 않는다. peer 정보가 없으면 주소/OTP 예산은 적용되지만 IP별 제한은 적용되지 않는다. 사용하는 HTTP 어댑터의 URL·헤더 한도는 별도로 설정/검증한다. 로컬 Node 어댑터에서 20 KiB URL/헤더는 431이었다. |
| RP/API 담당자 | JWT TTL과 introspection 사용 여부를 명시한다. logout/reset/replay 후 issuer introspection이 inactive인지 검사한다. 오프라인 JWT 서명 검증만 하는 서비스는 JWT 만료 전 즉시 폐기를 보장할 수 없다. 즉시 폐기가 필요하면 issuer 상태를 조회하도록 인수 기준을 정한다. |
| 메일 담당자 | 큐 대기/실패/만료 lease를 확인하고 영구 실패에 대응한다. SMTP timeout과 반송 정책은 사용하는 transport에 설정한다. 테스트 메일로 발송·중복 Message-ID 처리·수신 지연을 점검한다. |

## 1차 개선 검증 기록

| 검증 | 결과 |
| --- | --- |
| `pnpm verify:quick` | 통과. 정적 검사·전체 타입 검사, server 1,828개 / frontend Chromium unit 242개 / standalone 130개 / tools 55개 / homepage 6개 테스트. 합계 2,261개. |
| `git diff --check` | 통과. 생성된 ORM 파일의 후행 공백도 제거. |
| `ISSUARY_SECURITY_TEST_PG_PORT=<격리 포트> pnpm --filter @tinyrack/issuary-server test run src/routes/api/auth/security-regression.test.ts src/services/totp-security.test.ts` | PostgreSQL 18의 서로 다른 테스트 DB에서 19개 통과. 마이그레이션 적용, 세션·사용자 토큰 폐기, OTP/복구 코드/메일·재설정 토큰의 독립 컨텍스트 경쟁, 예산의 원자적 제한 포함. 동일 파일의 SQLite 검증은 verify:quick에 포함. |
| `pnpm --filter @tinyrack/issuary-frontend build` | 통과. 로컬 E2E에 필요한 SSR/클라이언트 산출물 생성. |
| source 조건의 Playwright `email-verification-2fa-required:chromium` | 3개 통과. 등록/로그인 이메일 인증 후 필수 MFA 설정, 잘못된 토큰 처리. |
| source 조건의 Playwright `oauth-providers-specific:chromium` | 17개 통과. GitHub/Google/Apple 모의 제공자, Apple form_post, 연결 및 callback 오류·재사용. |
| `api-inventory.test.ts` | verify:quick에서 통과. 81개 실제 라우트와 보고서·OpenAPI 일치, 관리자 전 메서드의 비로그인/일반 사용자 경계, 민감 HEAD 및 비허용 OPTIONS origin. |

Playwright는 `PLAYWRIGHT_HTML_OPEN=never pnpm --filter @tinyrack/issuary-frontend exec node --conditions=@issuary/source --import tsx node_modules/@playwright/test/cli.js test --project <위 프로젝트> --reporter=line`으로 실행했다. 첫 실행은 SSR 산출물 누락으로 500을 확인하여 빌드로 해결했다. 빌드 후 빠른 검증과 E2E를 함께 실행했을 때에는 SSR 응답이 78초 지연되어 navigation timeout이 발생했다. 실패 파일을 분리하여 재현 범위를 줄인 뒤, 빠른 검증 종료 후 외부 로그인 프로젝트를 실행해 확인했다. Playwright의 worker 설정·타임아웃·재시도 설정을 변경하지 않았다. 이 동시 작업의 자원 경합은 API 취약점으로 판정하지 않았다.

전체 `verify:full`, 전체 Chromium/Firefox E2E, Windows 및 운영 시스템 검증은 실행하지 않았다. 범위 밖 검증을 통과로 표시하지 않는다. 격리 PostgreSQL 컨테이너는 검증 후 제거하며 운영 DB 변경은 없다.

## R1~R5 최종 검증 기록

2026-09-10 최종 결과다. 위 1차 수치와 합산하지 않는다.

| 검증 | 결과 |
| --- | --- |
| `pnpm verify:quick` | 통과. 정적 검사·타입 검사와 server 1,876개 / frontend 243개 / standalone 130개 / tools 55개 / homepage 6개, 합계 2,310개 테스트. 최종 마이그레이션 보완까지 포함한다. |
| 공유 SQLite 분산 검사 | quick gate에 포함하여 통과. 독립 HTTP 서버 프로세스 2개와 IPC barrier로 code/refresh/device, 기본 수단 세 쌍, 필수 MFA, TOTP 재발급, 설정 동기화, 실제 프로세스 종료 후 메일 복구를 검사했다. |
| 격리 PostgreSQL 17 | 아래 네 파일의 32개 테스트 통과. 테스트 파일마다 별도 DB를 사용하며 한 분산 시나리오의 두 서버만 DB를 공유한다. 이후 시계가 앞선 기존 쿠키를 명시적으로 폐기하는 마이그레이션 보완도 해당 테스트를 SQLite와 PostgreSQL에서 각각 실행하여 통과했다. |
| 프런트엔드 빌드 | `pnpm --filter @tinyrack/issuary-frontend build` 통과. |
| source 조건 Chromium | `oauth-providers-specific:chromium`, `email-verification-2fa-required:chromium`, `email-verification:chromium`의 36개 테스트 통과. 로컬 HTTPS Apple 방식 form_post·쿠키·callback 재사용/만료·SSR 응답과 일반 제공자·이메일/MFA 정상 흐름을 포함한다. |
| `git diff --check` | 통과. |

PostgreSQL 실행 명령은 `SECURITY_POSTGRES_PORT=55439 pnpm --filter @tinyrack/issuary-server test run src/routes/oauth/distributed-security.test.ts src/entrypoints/database/security-migration.test.ts src/services/security-mutation.test.ts src/services/mail-queue.test.ts`다. Chromium은 `PLAYWRIGHT_HTML_OPEN=never pnpm --filter @tinyrack/issuary-frontend exec node --conditions=@issuary/source --import tsx node_modules/@playwright/test/cli.js test`에 위 세 `--project`를 지정했다.

격리 PostgreSQL 컨테이너와 테스트 DB는 제거했다. `verify:full`, 전체 브라우저 프로젝트, 실제 Apple·스테이징·운영 프록시 검증은 실행하지 않았다. 승인된 로컬 개선·검증 범위는 완료했으며, 실제 환경 인수 점검과 외부 서비스의 오프라인 JWT 즉시 폐기 한계는 위 절차에 남긴다.

## 코드 리뷰 후 인증 세대·트랜잭션 보완 (2026-09-10)

이 절은 위 R1~R5 완료 후 발견한 네 문제의 추가 수정 기록이다. 이전 검증 수치는 이 변경의 검증 결과와 합산하지 않는다.

| 문제 | 재현 및 영향 | 수정과 회귀 근거 |
| --- | --- | --- |
| C1 OAuth 연결 중 인증 폐기 | 제공자 응답을 대기하는 동안 비밀번호 재설정이 완료되면 callback은 401이어도 연결 행이 남고, 연결된 제공자로 다시 로그인할 수 있었다. | `withBrowserSecurity`가 사용자 행을 sub 순서로 잠근 뒤 브라우저 세션의 ID·revision·만료·사용자 인증 세대·인증 단계를 검사한다. 명시적 OAuth 연결 state에 대상 sub/epoch를 저장한다. 외부 OAuth/WebAuthn 검증 후 저장 직전에 검사하고, 인증수단 변경과 세션 저장을 하나의 트랜잭션으로 커밋한다. `review-security.test.ts`, `distributed-security.test.ts`에서 OAuth/passkey 대기 중 별도 프로세스의 로그아웃·재설정 후 401과 연결/자격증명 행 부재를 확인한다. |
| C2 이전 이메일 인증 링크 | 비밀번호 재설정 전에 발급한 미사용 이메일 링크로 자동 로그인할 수 있었다. | 이메일·재설정 토큰의 `user_epoch`를 사용자 잠금 안에서 검증한다. `invalidateUserAuthentication`이 epoch 교체와 미사용 토큰 만료를 같은 트랜잭션에서 처리한다. 이메일 인증·토큰 소비·MFA 대기/세션 발급도 원자적으로 처리한다. 비밀번호 변경·재설정·삭제/복원 뒤 이전 링크 거절, 새 링크 자동 로그인, 최종 세션 저장 실패 시 이메일 인증과 소비 롤백을 검사한다. |
| C3 시계 차이 | 앞선 시계에서 발급한 인증 기록은 나중에 다른 인스턴스에서 비밀번호를 바꿔도 폐기 시각 비교를 통과했다. | `token_epoch`를 필수 사용자 인증 세대로 사용한다. 세션의 전체 인증·MFA 대기·기억된 계정, code·device 승인의 세대가 현재 사용자와 일치해야 한다. 인증 시점에 확보한 세대를 보존한다. 시각은 만료와 `auth_time`에만 사용한다. 독립 서버의 Date를 각각 ±30초로 바꾸고 쿠키·MFA·계정 목록·code·device를 검사한다. |
| C4 OAuth 가입 완료 토큰 중복 소비 | 이미 연결된 계정의 가입 완료 토큰을 두 브라우저에서 제출하면 둘 다 로그인 세션을 받았다. | 가입 트랜잭션의 첫 DB 쓰기는 `consumed_at IS NULL AND expires_at > now` 조건부 소비다. 사용자/연결·동의·세션 저장과 완료 레코드 삭제가 함께 커밋된다. 경쟁 요청은 기존 `OAUTH_SESSION_EXPIRED` 400을 받는다. 연결·동의·세션 저장 실패에서 소비와 부분 변경 롤백을 확인한다. |

원래 네 재현은 수정 전 네 건 모두 실패했고, 정식 회귀 테스트로 옮긴 뒤 수정 후 통과했다. 외부 검증 대기는 테스트 프로세스의 IPC/Promise 동기화 지점으로 제어한다. 운영 코드에 테스트용 대기 지점이나 프로세스 내부 인증 잠금을 추가하지 않았다.

### 적용 경계

- 브라우저의 비밀번호·TOTP·passkey·OAuth 연결 변경은 `withBrowserSecurity`를 거친다. MFA 승격과 challenge 소비를 포함한 최종 세션 저장이 실패하면 DB 변경도 롤백한다. 자체 인증 세대를 바꾸는 비밀번호 변경과 사용자 삭제는 해당 사용자 인증을 지운 상태로 커밋한다. 폐기가 먼저 커밋된 요청은 401, DB 충돌은 409이며 자동 재실행하지 않는다.
- 작업자·재설정/이메일 토큰·설정 동기화는 브라우저 인증과 구분된 내부 서비스 경로로 사용자 잠금과 토큰/설정 근거를 검사한다. 설정의 실제 변경 시 같은 토큰 폐기 함수를 사용한다. 동일한 설정의 재시작은 epoch를 유지한다.
- 이메일 작업의 준비된 암호화 payload에도 사용자 세대를 저장한다. 재시도는 기존 토큰의 세대·소비·만료를 검사하며 폐기된 토큰을 새로 발급하지 않는다. 토큰 생성은 잠근 사용자에서 확보한 세대를 전달한다. 불필요한 사용자 재조회가 수정 시각을 바꾸어 등록 직후 비밀번호 재설정 메일을 누락시키던 부작용도 회귀 테스트로 수정했다.
- 인증 폐기는 401과 한·영·일 재로그인 안내를 사용한다. 무효 이메일/재설정 링크는 새 이메일 요청을 안내한다. OpenAPI에 인증 폐기 및 변경 충돌을 반영한다. 정상 성공 응답에 내부 epoch를 노출하지 않는다.

### 전환 절차

1. 구버전 서버와 이메일 작업자를 모두 종료한다. 구버전과 신버전을 동시에 실행하는 롤링 전환은 지원하지 않는다.
2. 기존 마이그레이션에 이어 양쪽 DB의 `Migration20260910200000_authentication_epoch`를 적용한다. 이전 마이그레이션은 수정하지 않았다. 사용자 epoch를 새로 발급하고 필수값으로 전환한다. 브라우저 세션, 이메일/재설정 토큰, code/device 및 가입 완료 대기 레코드를 삭제한다. 기존 `security.mail` 작업은 실패 종료하고 payload와 lease를 제거한다.
3. 동일 설정의 신버전 서버/작업자를 시작한다. 사용자에게 재로그인과 이메일 재요청을 안내한다. 이전 세대 없는 쿠키·JWT·메일 토큰을 허용하는 호환 경로는 없다. 마이그레이션을 되돌려도 폐기한 인증과 제거한 민감 payload는 복구하지 않는다.
4. SQLite의 사용자 테이블 재구성은 cascade 대상 passkey·TOTP·복구 코드·약관 동의를 보존하고, `foreign_key_check`가 비어 있음을 검사한 뒤 커밋한다. 기존 OAuth 연결, passkey 카운터, TOTP 비밀값의 보존과 이전 메일 payload 제거를 양쪽 DB의 전환 테스트로 확인했다. SQLite/PostgreSQL 스키마와 컴파일된 ORM 메타데이터, 정상 로그인·MFA·OAuth 연결·이메일/가입 흐름을 확인한다. 외부 서비스가 오프라인으로 검증하는 JWT는 만료 전 즉시 폐기를 보장하지 않으므로 앞선 인수 점검표의 TTL/introspection 정책을 적용한다.

실제 Apple·스테이징·운영 프록시 및 전체 브라우저/Windows 검증은 이 수정의 완료 범위에 포함하지 않는다. 해당 인수 항목은 미검증 상태를 유지한다.

### 추가 수정 검증 기록

| 검증 | 결과 |
| --- | --- |
| `pnpm verify:quick` | 최종 통과. 정적·타입 검사와 server 1,896개 / frontend 244개 / standalone 130개 / tools 55개 / homepage 6개, 합계 2,331개 테스트. |
| `git diff --check` | 최종 통과. |
| 수정 전 네 재현 | `review-security.test.ts`의 최초 네 테스트 모두 실패함을 확인한 뒤 수정했다. |
| 정식 회귀 | `review-security.test.ts` 12개가 SQLite와 격리 PostgreSQL에서 각각 통과했다. 폐기 후 연결 부재·후속 로그인 거절, 이전 링크 폐기, 시계 차이, 중복 가입, DB 실패 시 롤백을 포함한다. |
| 분산·DB 검증 | 공유 SQLite의 독립 서버 프로세스 검사 19개 통과. PostgreSQL에서는 `distributed-security`, `security-mutation`, `mail-queue`, `security-migration`, `review-security` 다섯 파일의 서로 다른 테스트 총 52개가 통과했다. 코드/refresh/device 경합, 시계 ±30초, OAuth/passkey 대기 중 폐기, 가입 토큰 동시 소비와 작업자 복구를 검사했다. |
| 마이그레이션 | 기존 OAuth 연결·passkey·TOTP와 이전 인증/메일 작업이 있는 DB에서 up/down 및 ORM 정합성을 SQLite와 PostgreSQL 양쪽에서 확인했다. 위 테스트 수와 중복 합산하지 않는다. |
| 프런트엔드 빌드 | `pnpm --filter @tinyrack/issuary-frontend build` 통과. |
| 관련 Chromium 흐름 | source 조건으로 이메일 인증, 필수 MFA 이메일 인증, 제공자별 OAuth, OAuth 약관 가입, 필수 passkey의 다섯 프로젝트 48개와 `minimal:chromium`의 `account-selection.test.ts` 7개, 총 55개 통과. 로컬 HTTPS Apple 방식 form_post와 정상 계정 선택도 포함한다. |

PostgreSQL 검사는 `SECURITY_POSTGRES_PORT`에 격리 포트를 지정하고 위 다섯 파일을 실행했다. 한 분산 시나리오의 독립 서버 두 개는 같은 테스트 DB를 공유하며, 시나리오 간 DB는 분리한다. 테스트를 위해 띄운 PostgreSQL 컨테이너는 제거했다.

검증 중 발견한 메일 토큰 준비의 불필요한 사용자 재조회, 사용자 테이블 재구성의 SQLite cascade 삭제, 변경된 오류 문구와 필수 epoch를 반영하지 못한 테스트 fixture도 수정하고 해당 검사를 먼저 통과시켰다. 중단된 Chromium 실행은 완료 결과로 집계하지 않고, 완료된 55개만 기록했다. 브라우저 검증과 최종 빠른 검증은 순차 실행했으며 재시도·sleep·동시성 축소로 테스트를 통과시키지 않았다.

최종 빠른 검증에서 기존 cron 오류 로깅 테스트의 1.5초 실시간 대기가 실패했고, 해당 파일 단독 실행에서도 재현했다. 가상 시계를 정확히 다음 cron 실행으로 진행시켜 오류 로그가 한 번 기록되는지 검사하도록 변경한 뒤 해당 파일의 5개 테스트가 통과했다. 운영 스케줄러 동작이나 테스트 재시도 설정은 바꾸지 않았다.


## 추가 리뷰: 가입 증명과 MFA 설정 권한 (2026-09-10)

- OAuth 가입 대기 토큰은 신규 계정 생성에만 사용한다. 같은 제공자 계정 또는 이메일의 사용자가 이미 존재하면 `400 OAUTH_SESSION_EXPIRED`로 거절하고 새 OAuth 로그인을 요구한다. 가입 중 기존 계정에 자동 연결하거나 현재 인증 세대로 로그인하는 분기를 제거했다. 가입 완료 시 같은 제공자 식별자/이메일의 다른 가입 대기 레코드도 삭제한다. 사용자 인증 폐기 시 이메일과 연결된 제공자 식별자로 관련 가입 증명을 삭제한다. 동시 신규 생성의 고유 제약 충돌은 기존 400, DB 직렬화 충돌은 기존 409로 반환한다.
- `pending2FASetup`으로 시작한 변경은 사용자 잠금을 확보한 뒤 현재 등록된 MFA를 다시 확인한다. 다른 브라우저가 등록을 완료했다면 401로 거절하고 재로그인하도록 한다. TOTP 검증 성공 시 브라우저 세션에 사용자 sub·TOTP 행 ID·사용한 step을 저장하고 확인 단계에서 대조한다. 다른 브라우저의 검증이나 교체된 설정으로 로그인할 수 없다. 성공·인증 전환 시 증명을 제거한다. 증명 저장과 TOTP 변경은 기존 세션 트랜잭션 안에 있다.
- 새로운 테이블/컬럼은 필요하지 않다. 기존 세션 JSON에 증명을 추가한다. 증명이 없는 이전 미완료 TOTP 설정은 OTP 검증을 다시 해야 한다. API의 성공 형식과 기존 한·영·일 재로그인/만료 오류 처리는 유지한다.

수정 전 세 재현은 모두 실패했다. 수정 후 해당 세 건과 기존 관련 검사를 포함한 65개가 통과했고, 가입 증명 삭제와 서로 다른 가입 토큰의 동시 제출 검사를 더한 최종 `enrollment-security.test.ts` 5개도 통과했다. 워크플로 정책 검사 8개, actionlint, `git diff --check`를 통과했다. 이 수치는 이전 검증 결과와 합산하지 않는다.

사용자의 로컬 자원 제한 요청에 따라 이번 변경의 로컬 `verify:quick`, DB 컨테이너 및 Chromium 전체 실행은 생략한다. PR CI에서 기존 빌드·정적 검사·소스 테스트 외에 `Security / PostgreSQL`과 `Security / Chromium`을 실행하고 두 결과를 `Quality Gate`의 필수 의존 작업으로 연결했다. PostgreSQL 작업은 독립 프로세스 경합·회귀·메일·마이그레이션을, Chromium 작업은 OAuth 가입·이메일·TOTP·passkey 정상 흐름과 로컬 HTTPS callback을 검사한다. CI의 실제 결과는 PR 체크에서 확인하며, 실행 전에는 통과로 간주하지 않는다.
