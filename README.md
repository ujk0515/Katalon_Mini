# Katalon Mini

Katalon Studio에서 영감을 받은 경량 웹 테스트 자동화 도구입니다.
Electron + React + Playwright 기반의 데스크톱 IDE로, Groovy 스타일 스크립트를 작성하고 실행할 수 있습니다.

## Tech Stack

| 구분 | 기술 |
|------|------|
| Desktop Framework | Electron 30 |
| Frontend | React 18 + Zustand |
| Code Editor | Monaco Editor |
| Styling | TailwindCSS (Dark Theme) |
| Browser Automation | Playwright (Chromium) |
| Script Parser | Chevrotain |
| Build | Vite + esbuild |
| Language | TypeScript |

## Getting Started

### Prerequisites

- **Node.js** 18 이상
- **npm** 9 이상

### Install & Run

```bash
# 의존성 설치 (Playwright Chromium 자동 설치)
npm install

# 개발 모드 실행
npm run dev

# 또는 프로덕션 빌드 후 실행
npm run build
npm start
```

### Scripts

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | 개발 모드 (Main + Renderer 동시 실행) |
| `npm run build` | 프로덕션 빌드 |
| `npm start` | 빌드된 앱 실행 |
| `npm run package` | 설치파일 생성 (electron-builder) |

## Features

- **Monaco Editor** - 구문 강조 지원 코드 편집기
- **테스트 실행** - Playwright 기반 브라우저 자동화
- **테스트 스위트** - 여러 테스트케이스를 묶어 순차 실행
- **실시간 로그** - 각 스텝별 상태/시간 실시간 표시
- **HTML 리포트** - 실행 결과 자동 생성
- **뷰포트 설정** - Window / 1280x720 / 1920x1080 / 1536x864
- **Headless 모드** - UI 없이 백그라운드 실행

## Supported Commands

```groovy
// 브라우저
WebUI.openBrowser()
WebUI.closeBrowser()
WebUI.navigateToUrl("https://example.com")

// 요소 조작
WebUI.click(findTestObject("xpath=/html/body/button"))
WebUI.setText(findTestObject("xpath=//input[@id='email']"), "test@test.com")
WebUI.clearText(findTestObject("xpath=//input"))

// 대기
WebUI.waitForElementPresent(findTestObject("xpath=//div"), 10)
WebUI.waitForElementVisible(findTestObject("xpath=//div"), 10)
WebUI.delay(2)

// 검증
WebUI.verifyElementPresent(findTestObject("xpath=//div"), 10)
WebUI.verifyElementText(findTestObject("xpath=//span"), "expected text")

// 프레임
WebUI.switchToFrame(findTestObject("xpath=//iframe"), 10)
WebUI.switchToDefaultContent()

// 흐름 제어
WebUI.callTestCase(findTestCase("Test Cases/login"))
WebUI.comment("메모")
```

## Project Structure

```
src/
├── main/                  # Electron 메인 프로세스
│   ├── index.ts           # 앱 진입점
│   ├── preload.ts         # IPC 브릿지
│   ├── engine/            # 테스트 실행 엔진
│   │   ├── lexer.ts       # 토크나이저
│   │   ├── parser.ts      # AST 파서
│   │   ├── commandMapper.ts   # Playwright 명령 매핑
│   │   ├── executor.ts        # 스크립트 실행기
│   │   ├── suiteExecutor.ts   # 스위트 실행기
│   │   ├── preprocessor.ts    # 전처리기
│   │   └── reportGenerator.ts # HTML 리포트 생성
│   └── handlers/          # IPC 핸들러
│       ├── projectHandlers.ts
│       ├── fileHandlers.ts
│       ├── scriptHandlers.ts
│       └── suiteHandlers.ts
├── renderer/              # React UI
│   ├── components/
│   │   ├── AppShell/      # 메인 레이아웃
│   │   ├── EditorPanel/   # Monaco 에디터 + 탭
│   │   ├── ProjectExplorer/   # 파일 트리
│   │   ├── SuiteEditor/   # 스위트 편집
│   │   ├── LogPanel/      # 실행 로그
│   │   ├── Toolbar/       # 실행/중지 버튼
│   │   └── StatusBar/     # 상태바
│   └── stores/            # Zustand 상태관리
└── shared/                # 공유 타입 정의
```

## Test Project Structure

프로젝트 생성 시 다음 구조가 만들어집니다:

```
MyProject/
├── katalon-mini.project.json   # 프로젝트 설정
├── Test Cases/                 # 테스트케이스 (.groovy)
├── Test Suites/                # 테스트 스위트 (.suite)
└── Reports/                    # HTML 리포트 (자동 생성)
```

## Platform Support

- Windows (x64)
- macOS (Intel / Apple Silicon)
