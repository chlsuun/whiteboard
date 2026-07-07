# 🎨 LiveBoard — 실시간 공유 화이트보드

아이패드, PC, 어떤 기기에서든 실시간으로 공유되는 협업 화이트보드입니다.

## 🚀 배포 방법

### 1단계: Firebase 프로젝트 생성

1. [firebase.google.com](https://firebase.google.com) 접속 → **시작하기**
2. 새 프로젝트 생성 (이름 자유)
3. 좌측 메뉴 → **빌드 → Realtime Database** 클릭
4. **데이터베이스 만들기** → **테스트 모드로 시작** 선택
5. 좌측 메뉴 → **프로젝트 설정** → **내 앱** → **웹 앱 추가** (`</>`)
6. 앱 등록 후 표시되는 `firebaseConfig` 값 복사

### 2단계: firebase-config.js 수정

```javascript
// firebase-config.js
const firebaseConfig = {
  apiKey: "실제-API-키로-교체",
  authDomain: "프로젝트ID.firebaseapp.com",
  databaseURL: "https://프로젝트ID-default-rtdb.firebaseio.com",
  projectId: "프로젝트ID",
  storageBucket: "프로젝트ID.appspot.com",
  messagingSenderId: "숫자ID",
  appId: "앱ID"
};
```

### 3단계: GitHub Pages 배포

```bash
# 1. GitHub 저장소 생성 (예: whiteboard)
# 2. 파일 업로드 또는 git push
git init
git add .
git commit -m "feat: 실시간 화이트보드 초기 배포"
git remote add origin https://github.com/[유저명]/whiteboard.git
git push -u origin main

# 3. GitHub Settings → Pages → main 브랜치 선택
# 4. 접속: https://[유저명].github.io/whiteboard
```

## 🔒 Firebase 보안 규칙 (선택)

테스트 완료 후 아래 규칙으로 교체하여 보안을 강화하세요:

```json
{
  "rules": {
    "whiteboard": {
      ".read": true,
      ".write": true,
      "strokes": {
        "$strokeId": {
          ".validate": "newData.hasChildren(['points', 'color', 'width'])"
        }
      }
    }
  }
}
```

## ✨ 기능

| 기능 | 설명 |
|---|---|
| 🖊️ 자유 드로잉 | 마우스/터치 지원 |
| 🎨 색상 팔레트 | 7가지 기본 색상 + 커스텀 색상 |
| 📏 브러시 크기 | 4단계 조절 |
| 🔲 지우개 | 부분 지우기 |
| ↩️ 실행 취소 | Ctrl+Z 또는 버튼 |
| 🗑️ 전체 지우기 | 모든 접속자에게 적용 |
| 👥 실시간 동기화 | Firebase Realtime Database |
| 🖱️ 원격 커서 | 다른 사용자의 커서 표시 |

## ⌨️ 단축키

| 키 | 기능 |
|---|---|
| `P` | 펜 도구 |
| `E` | 지우개 |
| `Ctrl+Z` | 실행 취소 |
| `Esc` | 모달 닫기 |
