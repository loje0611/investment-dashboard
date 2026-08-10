# GitHub 반영 및 Vercel 배포 가이드

이 문서는 Investment Dashboard 프로젝트를 GitHub에 올리고 Vercel로 배포하는 방법을 안내합니다.

데이터는 **로컬 CSV 파일**(`src/data/`)을 빌드에 포함하는 방식으로 동작합니다. Google Apps Script(GAS)는 사용하지 않습니다.

---

## 1. GitHub에 프로젝트 반영하기

### 1.1 Git 저장소 초기화 (이미 되어 있다면 건너뛰기)

```bash
cd /path/to/investment-dashboard
git init
```

### 1.2 .gitignore 확인 (GitHub에 올리면 안 되는 파일)

다음 항목이 `.gitignore`에 포함되어 있는지 확인하세요. **이 파일/폴더는 커밋하지 마세요.**

| 항목 | 설명 |
|------|------|
| `.env` | Google OAuth 클라이언트 ID 등 환경 변수 (비공개 유지) |
| `.env.local`, `.env.*.local` | 로컬 오버라이드 |
| `node_modules/` | 의존성 (설치로 복원) |
| `dist/` | 빌드 결과물 (Vercel 등에서 재빌드) |
| `.cursor/` | Cursor IDE 프로젝트 데이터 |

- `.env.example`은 **커밋해도 됩니다.** (값 없이 키만 있는 템플릿)
- `src/data/*.csv`는 대시보드 데이터 소스입니다. 개인 자산 정보가 포함될 수 있으므로 **공개 저장소에 올릴지 신중히 결정**하세요.

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

---

## 2. Vercel에 배포하기

### 2.1 Vercel 가입 및 GitHub 연동

1. [Vercel](https://vercel.com) 접속 후 **Sign Up** → **Continue with GitHub** 선택
2. GitHub 계정 권한 허용 후 Vercel 대시보드로 이동

### 2.2 프로젝트 Import

1. **Add New...** → **Project** 클릭
2. **Import Git Repository**에서 `investment-dashboard` 저장소 선택 후 **Import** 클릭

### 2.3 프로젝트 설정

| 항목 | 값 | 비고 |
|------|-----|------|
| **Framework Preset** | Vite | 자동 감지되면 그대로 사용 |
| **Root Directory** | `./` | 기본값 유지 |
| **Build Command** | `npm run build` | package.json 기준 |
| **Output Directory** | `dist` | Vite 기본 출력 폴더 |
| **Install Command** | `npm install` | 기본값 |

### 2.4 환경 변수 설정

Google 로그인을 사용하는 경우 **Environment Variables**에 다음을 추가합니다.

| Name | 설명 |
|------|------|
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud Console OAuth 2.0 웹 클라이언트 ID |

로컬 개발 전용 인증 우회(`VITE_AUTH_BYPASS`)는 프로덕션 빌드에서 무시되므로 Vercel에 설정할 필요가 없습니다.

### 2.5 배포 실행

**Deploy** 버튼을 클릭하면 빌드가 시작되고, 완료되면 배포 URL이 생성됩니다.

- 예: `https://investment-dashboard-xxxx.vercel.app`

---

## 3. 배포 후 확인

1. Vercel 대시보드에서 **Visit** 또는 발급된 URL로 접속
2. Google 로그인 후 홈·자산 상세·리밸런싱 탭이 정상 동작하는지 확인
3. CSV 데이터가 반영되지 않으면 `src/data/` 파일이 커밋·배포에 포함됐는지 확인

---

## 4. 데이터 갱신

| 작업 | 방법 |
|------|------|
| 보유 종목 시세 | 로컬에서 `python scripts/update_prices.py` 실행 후 CSV 커밋·푸시 |
| 총자산·상품 이력 | `history.csv`, `etf_history.csv`, `pension_history.csv` 등을 직접 편집 후 커밋·푸시 |

---

## 5. 이후 업데이트 반영

코드 수정 후 GitHub에 푸시하면 Vercel이 자동으로 다시 빌드·배포합니다.

```bash
git add .
git commit -m "설명 메시지"
git push origin main
```

---

## 6. Vercel 빌드 실패 시

- **에러 메시지 확인**: Vercel 대시보드 → 해당 배포 → **Logs**에서 에러 전체를 확인하세요.
- **자주 나오는 원인**
  - **TypeScript/린트 에러**: 로컬에서 `npm run build` 실행해 보면 같은 에러가 나옵니다.
  - **Node 버전**: Vercel 기본은 Node 18입니다. 필요하면 `.nvmrc`(예: `20`)를 추가하세요.
- 빌드는 성공했는데 **데이터가 비어 있다면**: `src/data/portfolio.csv`, `history.csv` 등이 저장소에 포함됐는지 확인하세요.

---

## 7. 참고 사항

- **환경 변수 변경**: Vercel → Project → **Settings** → **Environment Variables**에서 수정 후 재배포
- **커스텀 도메인**: Vercel 프로젝트 **Settings** → **Domains**에서 설정 가능
