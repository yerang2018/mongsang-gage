# 꿈툰 설정 안내 (코딩 몰라도 따라 하기)

## 1단계: Supabase 연결하기 (약 10분, 무료)

Supabase = 회원가입·로그인과 데이터(꿈, 구슬)를 저장해 주는 서비스예요.

### ① 계정과 프로젝트 만들기
1. https://supabase.com 에서 **Start your project** → GitHub 계정으로 가입
2. **New project** 클릭
   - Name: `kkumtoon`
   - Database Password: **Generate a password** 누르고, 비밀번호를 메모장에 따로 저장
   - Region: **Northeast Asia (Seoul)**
3. **Create new project** → 1~2분 기다리기

### ② 주소와 공개 키 복사해서 넣기
1. 프로젝트 화면 위쪽 **Connect** 버튼(또는 왼쪽 아래 톱니바퀴 **Project Settings → API Keys**)
2. 두 가지를 복사
   - **Project URL** (`https://xxxx.supabase.co` 모양)
   - **Publishable key** (`sb_publishable_`로 시작. 없으면 **anon public** 키)
3. VS Code나 텍스트 편집기로 `kkumtoon/.env.local` 파일을 열고 아래 두 줄을 추가 후 저장

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxx
```

> 이 두 값은 원래 공개돼도 괜찮은 값이에요. 그래도 **secret 키 / service_role 키**는 절대 넣거나 공유하지 마세요.

### ③ 데이터베이스 표 만들기
1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. `kkumtoon/supabase/migrations/0001_init.sql` 파일 내용을 **전부 복사**해서 붙여 넣기
3. 오른쪽 아래 **Run** → 아래쪽에 `Success. No rows returned` 가 나오면 성공
   (경고창이 뜨면 **Run this query** 눌러도 돼요)

### ④ 로그인 링크가 돌아올 주소 등록
1. 왼쪽 메뉴 **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:3000` → Save
3. **Redirect URLs** → **Add URL**: `http://localhost:3000/auth/callback` → Save

### ⑤ 확인하기
터미널에서:

```bash
cd ~/Documents/GitHub/kkumtoon && npm run dev
```

브라우저에서 http://localhost:3000 열고:
1. **시작하기** → 내 이메일 입력 → **로그인 링크 받기**
2. 메일함에서 링크 클릭 (같은 브라우저에서 열기!)
3. 닉네임 정하기 → 홈 화면에 **꿈 구슬 1,010개** (가입 1,000 + 오늘 첫 방문 10)이 보이면 성공

### 자주 막히는 곳
- **메일이 안 와요**: 스팸함 확인. Supabase 무료 메일은 **1시간에 몇 통**만 보낼 수 있어서 여러 번 누르면 막혀요. 1시간 뒤 다시 시도.
- **"설정이 필요해요" 화면이 계속 나와요**: `.env.local` 저장 후 터미널에서 `Ctrl + C`로 서버를 끄고 다시 `npm run dev`.
- **링크를 눌렀는데 다시 로그인 화면이 나와요**: 링크를 다른 브라우저(예: 메일 앱 안 브라우저)에서 열었을 수 있어요. 휴대폰 말고 이메일을 요청한 그 컴퓨터 브라우저에서 열어 주세요.

## 2단계 이후 (그때 알려 드릴게요)
- Gemini API 키 (해몽 글, 무료) — 2단계
- OpenAI API 키 (그림, 유료 $5 충전) — 3단계
- Vercel 배포 — 6단계
