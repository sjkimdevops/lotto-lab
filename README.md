# LOTTO LAB

로또 6/45 + 연금복권 720+ 번호 추천 웹앱  
Netlify 무료 호스팅

## 배포 방법

### 1. GitHub에 올리기

```bash
cd lotto-netlify
git init
git add .
git commit -m "init: lotto lab"
git remote add origin https://github.com/sjkimdevops/lotto-lab.git
git push -u origin main --force
```

### 2. Netlify에 배포

1. [app.netlify.com](https://app.netlify.com) → GitHub 계정으로 로그인
2. "Add new site" → "Import an existing project"
3. GitHub 선택 → `lotto-lab` 레포 선택
4. 설정 변경 없이 "Deploy site" 클릭
5. 1분 후 URL 생성 완료!

### 이후 업데이트

`git push`만 하면 자동 재배포됩니다.

## 프로젝트 구조

```
lotto-lab/
├── netlify/
│   └── functions/
│       └── lotto.js       ← Serverless Function (API 프록시)
├── public/
│   └── index.html         ← 프론트엔드
├── netlify.toml            ← Netlify 설정
└── README.md
```
