
# WikiSearcher Chrome Plugin

---

## 구성 요소

1. MathJax - submodule
2. manifest.json
3. scripts 폴더
>+ content_script.js
>+ service_worker.js
>+ jquery-3.7.1.min.js
4. homonym_handler 폴더
>+ model 폴더(hugging face의 bongsoo/albert-small-kor-sbert-v1 모델 저장) <https://huggingface.co/bongsoo/albert-small-kor-sbert-v1>
>+ homonym_handler.py - 문장 임베딩 및 cosine_similarity 계산 후 반환
5. sidePanel 폴더
>+ side_panel.html
>+ side_panel.css
>+ side_panel.js
6. image 폴더
>+ image_done.png
>+ image_ready.png
>+ loading_screen.gif
7. wikiSearcher.py

---

## MathJax - submodule

문서 내의 수식과 같이 추가적인 Rendering이 필요한 LaTeX문법을 처리하기 위해 추가시킨 오픈 소스 js display engine

GitHub 주소 : <https://github.com/mathjax/MathJax/tree/b6922e564070d20888f680a289381702a266718f>

---

## manifest.json

플러그인의 구성 요소, 권한 등을 설정하는 파일
플러그인 폴더의 최상단에 위치해야 함

---

## scripts 폴더

### content_script.js

유저의 웹 페이지 html DOM에 접근하여 button을 생성하고 검색을 요청하는 파일

### service_worker.js

플러그인의 background에서 중앙 이벤트 리스너의 역할을 하는 파일

---

## homonym_handler 폴더

### model 폴더

동음이의어 처리를 위한 BERT모델을 저장한 파일
사용한 모델 <https://huggingface.co/bongsoo/albert-small-kor-sbert-v1>

### homonym_handler.py

BERT 모델을 사용해 인자로 받은 문장들을 임베딩 한 후 cosine_similarity를 계산하여 반환하는 파일

---

## sidePanel 폴더

### side_panel.html

플러그인 사이드 패널의 html 파일

### side_panel.css

플러그인 사이드 패널의 css 파일

### side_panel.js

플러그인 사이드 패널의 js 파일

---

## image 폴더
>+ image_done.png : 검색 준비가 완료됬음을 나타내는 이미지
>+ image_ready.png : 검색을 준비함을 나타내는 이미지
>+ loading_screen.gif : 사이드 패널의 로딩화면에 사용하는 이미지

---

## wikiSearcher.py

>+ 플러그인의 서버를 구성하는 파일
>+ aiohttp 프레임워크를 사용하여 서버를 구성
>+ 위키피디아 검색을 위해 wikipedia-api 모듈을 사용


