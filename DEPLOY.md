# GitHub 반영 및 Vercel 배포 가이드

이 문서는 Investment Dashboard 프로젝트를 GitHub에 올리고 Vercel로 배포하는 방법을 안내합니다.

---

## 1. GitHub에 프로젝트 반영하기

### 1.1 Git 저장소 초기화 (이미 되어 있다면 건너뛰기)

```bash
cd /home/keunu/investment-dashboard
git init
```

### 1.2 .gitignore 확인 (GitHub에 올리면 안 되는 파일)

다음 항목이 `.gitignore`에 포함되어 있는지 확인하세요. **이 파일/폴더는 커밋하지 마세요.**

| 항목 | 설명 |
|------|------|
| `.env` | GAS Web App URL 등 환경 변수 (비공개 유지) |
| `.env.local`, `.env.*.local` | 로컬 오버라이드 |
| `node_modules/` | 의존성 (설치로 복원) |
| `dist/` | 빌드 결과물 (Vercel 등에서 재빌드) |
| `.cursor/` | Cursor IDE 프로젝트 데이터 |

- `.env.example`은 **커밋해도 됩니다.** (값 없이 키만 있는 템플릿)
- `investment_dashboard.gs`는 저장소에 **플레이스홀더 ID**(`YOUR_SPREADSHEET_ID`)로 올라가 있습니다. 클론 후 GAS에 배포할 때 본인 스프레드시트 ID로 바꿔 사용하세요.

### 1.3 첫 커밋

```bash
git add .
git status   # .env가 목록에 없어야 함
git commit -m "Initial commit: Investment Dashboard"
```

### 1.4 GitHub 저장소 만들기

1. [GitHub](https://github.com) 로그인 후 **New repository** 클릭
2. **Repository name**: `investment-dashboard` (원하는 이름 사용 가능)
3. **Public** 선택, **Add a README** 등은 체크하지 않고 **Create repository** 클릭

### 1.5 원격 저장소 연결 및 푸시

GitHub에서 생성된 저장소 URL을 사용합니다. (예: `https://github.com/YOUR_USERNAME/investment-dashboard.git`)

```bash
git remote add origin https://github.com/YOUR_USERNAME/investment-dashboard.git
git branch -M main
git push -u origin main
```

- GitHub에서 **SSH**를 사용한다면:  
  `git@github.com:YOUR_USERNAME/investment-dashboard.git` 형태로 `origin`을 추가하면 됩니다.
- 이미 `main`이 아닌 브랜치를 쓰고 있다면 해당 브랜치 이름으로 푸시하면 됩니다.

---

## 2. Vercel에 배포하기

### 2.1 Vercel 가입 및 GitHub 연동

1. [Vercel](https://vercel.com) 접속 후 **Sign Up** → **Continue with GitHub** 선택
2. GitHub 계정 권한 허용 후 Vercel 대시보드로 이동

### 2.2 프로젝트 Import

1. **Add New...** → **Project** 클릭
2. **Import Git Repository**에서 방금 푸시한 `investment-dashboard` 저장소 선택 후 **Import** 클릭

### 2.3 프로젝트 설정

| 항목 | 값 | 비고 |
|------|-----|------|
| **Framework Preset** | Vite | 자동 감지되면 그대로 사용 |
| **Root Directory** | `./` | 기본값 유지 |
| **Build Command** | `npm run build` | package.json 기준 |
| **Output Directory** | `dist` | Vite 기본 출력 폴더 |
| **Install Command** | `npm install` | 기본값 |

### 2.4 환경 변수 설정 (필수)

빌드 시 GAS Web App URL이 필요하므로 **Environment Variables**에 다음을 추가합니다.

1. **Name**: `VITE_WEB_APP_URL`
2. **Value**: 실제 사용 중인 Google Apps Script Web App URL  
   (예: `https://script.google.com/macros/s/AKfycbw.../exec`)
3. **Environment**: Production, Preview, Development 모두 체크 권장

**주의**: URL은 반드시 `/exec`로 끝나는 배포 주소를 사용하세요. `/dev`는 CORS 등 이슈가 있을 수 있습니다.

### 2.5 배포 실행

**Deploy** 버튼을 클릭하면 빌드가 시작되고, 완료되면 배포 URL이 생성됩니다.

- 예: `https://investment-dashboard-xxxx.vercel.app`

---

## 3. 배포 후 확인

1. Vercel 대시보드에서 **Visit** 또는 발급된 URL로 접속
2. 홈·자산 상세·리밸런싱 탭이 정상 동작하는지 확인
3. 데이터가 나오지 않으면 **VITE_WEB_APP_URL**이 올바른지, GAS 웹앱이 “누구나” 접근 가능한지 확인

---

## 4. 이후 업데이트 반영

코드 수정 후 GitHub에 푸시하면 Vercel이 자동으로 다시 빌드·배포합니다.

```bash
git add .
git commit -m "설명 메시지"
git push origin main
```

Vercel 대시보드의 **Deployments** 탭에서 배포 상태와 로그를 확인할 수 있습니다.

---

## 5. 참고 사항

- **GAS 스크립트**: `investment_dashboard.gs`는 Google Apps Script에 별도로 배포해야 합니다. 이 프로젝트는 GAS 웹앱 **URL을 호출하는 프론트엔드**입니다.
- **환경 변수 변경**: Vercel 대시보드 → Project → **Settings** → **Environment Variables**에서 수정 후 재배포하면 적용됩니다.
- **커스텀 도메인**: Vercel 프로젝트 **Settings** → **Domains**에서 설정 가능합니다.
