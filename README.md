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

## 당첨번호 데이터 업데이트

당첨번호는 정적 JSON(`public/data/*.json`)으로 서빙되며, 동행복권 사이트의
JSON 엔드포인트에서 받아온다. GitHub Actions가 추첨 직후 자동 실행하지만
수동으로도 돌릴 수 있다 (외부 의존성 없음, Node 18+).

```bash
node fetch-lotto.js              # 로또 6/45 — 누락 회차만 추가
node fetch-pension.js            # 연금복권 720+ — 누락 회차만 추가

node fetch-lotto.js --rebuild    # 전 회차 재수집 후 덮어쓰기
node fetch-pension.js --rebuild
```

두 스크립트 모두 저장 전에 검증한다. 번호 범위(1~45), 본번호 6개 중복 여부,
보너스 중복 여부, 추첨 요일(로또 토 / 연금복권 목), 회차 연속성, 7일 간격을
확인해 **한 건이라도 어긋나면 파일을 쓰지 않고 exit 1** 한다. 따라서 사이트
구조가 바뀌어 파싱이 깨지면 조용히 잘못된 데이터가 커밋되는 대신 워크플로가
실패한다.

사용 엔드포인트:

| 대상 | 엔드포인트 |
|---|---|
| 로또 6/45 | `GET /lt645/selectPstLt645InfoNew.do?srchDir=center&srchLtEpsd=N` (N-5 ~ N+4, 10건) |
| 연금복권 720+ | `GET /pt720/selectPstPt720WnList.do` (전 회차 일괄) |

## 프로젝트 구조

```
lotto-lab/
├── .github/workflows/
│   └── update-lotto.yml    ← 추첨 후 당첨번호 자동 수집 + 커밋
├── fetch-lotto.js          ← 로또 6/45 수집기 (검증 포함)
├── fetch-pension.js        ← 연금복권 720+ 수집기 (검증 포함)
├── lib/dh-http.js          ← 동행복권 JSON 엔드포인트 HTTP 헬퍼
├── netlify/
│   └── functions/
│       └── lotto.js        ← Serverless Function (현재 프론트엔드 미사용)
├── public/
│   ├── data/               ← lotto.json / pension.json (프론트엔드가 직접 읽음)
│   └── index.html          ← 프론트엔드
├── netlify.toml            ← Netlify 설정
└── README.md
```
