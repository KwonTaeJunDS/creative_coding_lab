# Steamy Glass

Interactive fogged-glass webcam experience built with React, TypeScript, Vite, Tailwind CSS, MediaPipe Hands, and the HTML5 Canvas API.

## Links

- Live demo: [05steamyglass.vercel.app](https://05steamyglass.vercel.app)
- GitHub repository: [KwonTaeJunDS/creative_coding_lab/tree/main/steam_glass](https://github.com/KwonTaeJunDS/creative_coding_lab/tree/main/steam_glass)

## Features

- Fullscreen mirrored webcam scene
- Clean fogged-glass overlay with wipe-to-reveal interaction
- MediaPipe-based hand tracking
- Two gesture modes:
  - Index finger: precise wipe
  - Open palm: wide wipe
- Re-steaming effect that gradually fogs the glass again
- Wipe sound effect triggered while interacting

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- `@mediapipe/tasks-vision`
- HTML5 Canvas API

## Getting Started

```bash
npm install
npm run dev
```

Open the local URL shown by Vite and allow webcam access.

## Build

```bash
npm run build
```

## Project Structure

```text
src/
  components/
  hooks/
  assets/
public/
  models/
  sounds/
```

## Credits

Made in TouchDesigner using MediaPipe (The Tracker by @okamirufu.vizualizer).

This web adaptation was built with respect for the original inspiration and tracking workflow.

---

# 스티미 글래스

React, TypeScript, Vite, Tailwind CSS, MediaPipe Hands, HTML5 Canvas API로 만든 인터랙티브 김서림 유리 웹 프로젝트입니다.

## 링크

- 라이브 데모: [05steamyglass.vercel.app](https://05steamyglass.vercel.app)
- GitHub 저장소: [KwonTaeJunDS/creative_coding_lab/tree/main/steam_glass](https://github.com/KwonTaeJunDS/creative_coding_lab/tree/main/steam_glass)

## 주요 기능

- 전체 화면 미러 웹캠
- 손으로 닦아내는 김서림 유리 인터랙션
- MediaPipe 기반 손 추적
- 두 가지 제스처 모드
  - 검지 손가락: 정밀 닦기
  - 손바닥: 넓게 닦기
- 시간이 지나면 다시 서리는 효과
- 닦는 동작과 함께 재생되는 사운드

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 표시되는 로컬 주소를 열고 카메라 권한을 허용하면 됩니다.

## 빌드

```bash
npm run build
```

## 크레딧

Made in TouchDesigner using MediaPipe (The Tracker by @okamirufu.vizualizer).

원작의 아이디어와 트래킹 워크플로우에 대한 존중을 담아 웹 버전으로 재해석했습니다.
