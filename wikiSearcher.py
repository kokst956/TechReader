import wikipediaapi
import asyncio
from aiohttp import web #need 'pip install aiohttp'
import json
import pandas as pd
import numpy as np
import re
from pecab import PeCab
from concurrent.futures import ThreadPoolExecutor
from sklearn.feature_extraction.text import TfidfVectorizer #need 'pip install scikit-learn'
from sklearn.metrics.pairwise import cosine_similarity
import requests
from bs4 import BeautifulSoup
import threading
from konlpy.tag import Okt
from sentence_transformers import SentenceTransformer
from homonym_handler.homonym_handler import homonym_handling

WIKI = wikipediaapi.Wikipedia('201803851@o.cnu.ac.kr','ko')
ADDRESS = '0.0.0.0'
PORT = 8888

okt = Okt()
model = SentenceTransformer('homonym_handler/model')

def wiki_data_json(word, summary, explain, related, link_homonym):
    """
    sidePanel에 제공할 json정보 객체를 만드는 함수

    word: 검색한 단어가 위키피디아에 저장되어있는 제목을 저장(text)

    summary: 위키피디아 페이지에서 제일 상단에 있는 단어의 요약문을 저장(text)

    explain: 위키피디아 페이지의 section별 제목과 내용을 저장(구분자 '|-|'로 section을 나누고, section정보는 구분자'|'로 나눈 text)

    related: 위키피디아 section 중 '같이 보기'에 저장된 link('word(id:??, ns:??)'로 구성된 str 변수)들 중 해당 link의 내용이 실제로 존재하는 link들에 대한 정보를 저장(구분자 '|'로 저장된 text), 같이 보기가 없을 시 'none'

    link_homonym: 동음이의어가 있는 상황일 시, 해당 동음이의어 들의 link를 cosine유사도가 높은 순서대로 저장한 배열의 정보를 저장

    return: 위 내용물을 json형식으로 변환한 객체를 반환
    """ 

    result = {'word': word, 'summary': summary, 'explain' : explain, 'related': related, 'link_homonym' : link_homonym}
    return json.dumps(result, ensure_ascii=False)

### - TFIDF를 활용한 related 추출 코드 (토의 후 제거 여부 결정)
# def fetch_page_text(link):
#     page = WIKI.page(link)
#     if page.exists():
#         return (link, page.text)
#     return (link, "")

# def get_top_related_words(related, text, top_n=5):
#     with ThreadPoolExecutor(max_workers=10) as executor:
#         future_to_link = {executor.submit(fetch_page_text, link): link for link in related.keys()}
#         related_texts = []
#         related_titles = []

#         for future in future_to_link:
#             link, page_text = future.result()
#             if page_text:  # 빈 페이지 텍스트는 제외
#                 related_texts.append(page_text)
#                 related_titles.append(link)

#     if not related_texts:
#         return []

    # # TF-IDF Vectorizer 적용
    # vectorizer = TfidfVectorizer()
    # vectors = vectorizer.fit_transform([text] + related_texts)
    
    # # 코사인 유사도 계산 (첫 번째 벡터는 검색어에 해당)
    # cosine_similarities = cosine_similarity(vectors[0:1], vectors[1:]).flatten()

    # # 유사도가 높은 상위 n개 관련 단어 선택
    # top_indices = cosine_similarities.argsort()[-top_n:][::-1]
    # top_related = [related_titles[i] for i in top_indices]

    # return top_related
###

def remove_dummy_text(text):
    """
    wikipedia latex형식({\......})이 해당 형식 앞에 내용으로 사용된 parmeter들을 포함하고 있기에 중복으로 사용하면 렌더링 후, 그 앞에 parameter들이 중복으로 출력되게 됨.
    그래서 그것을 제거해 주는 함수가 필요

    text: change_brace()함수의 결과로 만들어진 MathJax latex형식의 문장

    return: 중복이 아닌 parameter들을 모아놓은 배열을 줄바꿈을 구분자로 결합시킨 str 변수 반환
    """
    text = re.sub(r'\n+', '\n', text)
    text = re.sub(r'\s{2,}\\\(\\', r'\n\\(\\', text)
    text_split = text.split('\n')
    result = []
    for textVal in text_split:
        if(not re.match(r"(\s{2,}.+)", textVal)): #줄바꿈을 기준으로 나누면 중복 parameter들이 앞에 2개 이상의 공백을 포함한 영어 text로 구분되게 됨 - 그것을 파악하여 제외함
            result.append(textVal)
    
    return "\n".join(result)

def change_brace(section_text):
    """
    MathJax에서 사용하는 inline형식의 latex문서 형식('\(\....\)')으로 변경하기 위해 wikipedia latex의 형식('{\...}')을 수정하는 함수 
    
    section_text: section별로 문서의 내용을 정리한 배열

    stack: '{'와 '}'를 매칭시키기 위해 사용하는 stack

    return: 괄호를 수정한 한 section의 문서 내용 배열을 이어붙은 str변수를 반환
    """
    stack = []
    result = []
    
    for char in section_text:
        if char == '|':
            if not stack:
                stack.append(char)
                result.append('\\(\\')
            else:
                stack.append('`')
                result.append('\\')
            
        elif char == '}':
            if stack and stack[-1] == '|':
                stack.pop()
                result.append('\\)')
            elif stack and stack[-1] == '`':
                stack.pop()
            else:
                stack.pop()
                result.append(char)
        elif char == '{':
            stack.append(char)
            result.append(char)
        else:
            result.append(char)

    return ''.join(result)


def handle_latex(section_text):
    """
    wikipedia 문서에서 사용하는 latex형식의 내용이 있을 시 그를 MathJax에서 사용하는 방식의 latex문법으로 변형 시켜주는 함수

    section_text: section별로 문서의 내용을 정리한 배열

    return: Mathjax에서 적용가능한 latex문법을 사용한 section별 문서 내용을 가진 배열
    """
    re_text = re.sub(r'{\\', '|', section_text)
    section_change = change_brace(re_text)
    print(section_change)
    result = remove_dummy_text(section_change)
    
    return result

def get_sections(sections, dept = 2):
    """
    위키피디아 정보 페이지의 데이터를 section별로 나누어 배열에 저장에 반환하는 함수

    section: 해당 페이지의 section의 제목과 내용, 하위 section에 대한 정보를 가진 객체

    dept: section이 최상단 객체일 시 2의 값을 가지고, 하위로 내려갈 수록 숫자가 1씩 늘어남 - 이후 sidePanel에서 h2, h3등을 설정할 때 사용

    related: section 중 '같이 보기'라는 section이 존재할 시 해당 section을 배열에 넣지 않고 따로 저장함
    
    return : section을 순서별로 저장한 배열과 related 반환
    """
    sectionS_arr = []
    related = 'none'
    for section in sections:
        if(section != ''):
            section_text = section.text
            if('{\\' in section_text): #wikipedia의 latex문법의 도입부로 해당 section_text내에 latex문법이 존재하는지 확인함
                section_text = handle_latex(section_text)
            section_arr = [dept, section.title, section_text]
            
            if(section.title == "같이 보기"): #section의 이름이 '같이 보기'인 경우에만 관련 단어로 제공함
                related = section_arr
            else:
                sectionS_arr.append(section_arr)
                sectionS_arr2,_ = get_sections(section.sections, dept = dept+1)
                if sectionS_arr2:
                    sectionS_arr = sectionS_arr + sectionS_arr2
    return sectionS_arr, related

def findRelatedLink(wikiReader, related):
    """
    get_section함수에서 반환받은 related를 받아서 위키피디아에 내용이 존재하는 페이지의 link('word(id:??, ns:??)'로 구성된 str 변수)를 가져오는 함수

    wikiReader: 검색 단어의 위키피디아 페이지 정보를 저장한 객체

    related: get_section함수에서 반환받은 related 정보
    """
    links = wikiReader.links
    related = related[2]
    relatedList = related.split('\n')
    relatedSplits = []

    for relatedVal in relatedList:
        if(relatedVal.strip() != ""):
            if(WIKI.page(relatedVal).exists()):
                relatedSplits.append(relatedVal.strip())

    relatedLinks = [link for link in relatedSplits if link in links]

    return relatedLinks
    


def get_text(wikiReader):
    # top_related = get_top_related_words(related, original_text)  - 토의 후 제거여부 결정 코드
    """
    최종적으로 sidePanel에 제공할 explain과 related를 만드는 함수
    
    ---argument---

    wikiReader: 검색 단어의 위키피디아 페이지정보를 저장한 객체

    ---local variable---

    str_section : section 정보 배열을 구분자 "|-|"를 통해 저장한 text변수 (여유가 된다면 배열로 바꾸는 것을 고려)

    related: findRelatedLink함수를 통해 얻은 실제 link('word(id:??, ns:??)'로 구성된 str 변수)가 존재하는 related를 저장한 변수

    """
    sections = wikiReader.sections
    sectionArr, related = get_sections(sections)
    if(related != 'none' and related != "해당 단어가 존재하지 않습니다."):
        related = findRelatedLink(wikiReader, related)
    return sectionArr, related

def check_homonym(wikiReader):
    """
    위키피디아 검색 시, 검색단어가 동음이의어라면 결과물의 페이지 category가 '동음이의' 혹은 '동명이인'을 포함한다는 것을 활용한 동음이의어 체크 코드

    ---argument---

    wikiReader: 검색 단어의 위키피디아 페이지정보를 저장한 객체
    """
    for category in list(wikiReader.categories.keys()):
        if('동음이의' in category or '동명이인' in category):
            return True
    return False

### 높은 확률로 실제로 사용할 코드 - 사용위치가 기억이 잘안남
# def clean_text(text):
#     # LaTeX 형식의 수식 및 기호 제거
#     text = re.sub(r'\{\{[^{}]+\}\}', '', text)  # 중괄호 내부의 LaTeX 수식 제거
#     text = re.sub(r'\{\\displaystyle [^{}]+\}', '', text)  # \displaystyle 제거
#     text = re.sub(r'\{\\mathcal [^{}]+\}', '', text)  # \mathcal 제거
#     text = re.sub(r'\\displaystyle', '', text)  # \displaystyle 제거
#     text = re.sub(r'\\mathcal', '', text)  # \mathcal 제거
#     text = re.sub(r'\$[^\$]*\$', '', text)  # $...$ 형식의 LaTeX 수식 제거

#     # 연속된 공백을 하나의 공백으로 축소
#     text = re.sub(r'\s+', ' ', text)
#     text = re.sub(r'\{\{[^\}]+\}\}', '', text)  # 중괄호 내부 내용 제거
#     text = re.sub(r'\[\[[^\]]+\]\]', '', text)  # 대괄호 내부 내용 제거
#     text = re.sub(r'{[^{}]+}', '', text)  # 중괄호 내부 내용 제거

#     return text
###

# def pre_text(text): #출처 : https://icedhotchoco.tistory.com/entry/DAY-64 // 뉴스 토픽 분류 - KoNLpy, 어간 추출, 불용어 제거, tfidfVectorizer
#     """
#     TFIDF방식을 사용할 때, 형태소 분석기 okt를 활용한 text 전처리 함수 - 조사, 어미와 같이 필요 없는 부분을 제거해 주는 함수
#     return - 구분자 " "를 통해 결과물 배열을 합친 text 
#     """
#     word_list = []
#     okt_pos = okt.pos(text, norm=True, stem=True)

#     for word in okt_pos:
#         if word[1] not in ['Josa', 'Eomi', 'Punctuation']:
#             word_list.append(word[0])
    
#     result = " ".join(word_list)

#     return result

def handle_homonym(links, original_text):
    """
    TFIDF방식의 동음이의어 처리 방식과 BERT모델의 동음이의어 처리 방식을 포함한 함수

    BERT모델의 경우 hugging face의 bongsoo/albert-small-kor-sbert-v1 모델을 사용
    모델의 사용법 : 웹 페이지에서 검색 단어가 사용된 문장들을 하나의 text로 만들어 임베딩하고, 위키피디아의 해당 단어 페이지의 summary부분을 가져와 임베딩한 것과 cosine_similarity를
    비교하여 가장 큰 값을 선택하는 방식을 사용
    TFIDF 방식에 비해 웹페이지에서 검색단어의 사용빈도가 적더라도 높은 동음이의어 정답율을 보임
    하위 함수로 thread_function을 가짐

    ---argument---

    links: 검색 단어의 동음이의어 페이지에 존재하는 모든 link('word(id:??, ns:??)'로 구성된 str 변수)정보를 가진 배열

    original_text: 검색을 요청한 웹 페이지에서 해당 단어가 사용된 문장을 모두 포함한 배열. 함수 내부에서 구분자 ' '를 활용한 str로 합쳐서 사용함

    ---local variable---

    link_unhomonym: 검색 단어의 위키피디아 동음이의어 페이지에서 해당 페이지내의 link들을 가져와서 모두 저장함(동음이의어 관련 단어들의 링크가 아닌 필요없는 링크들을 제거하여 저장)

    threadArr: 동적으로 생성된 thread들을 저장해놓는 배열(모든 thread가 끝나는 것을 대기하기 위해 사용)

    idNum: 각 thread에 할당한 similarities배열의 index를 나타내는 int 변수

    similarities: thread의 결과물을 단어+"||"+str(cosine유사도)로 도출하면 그 결과를 thread의 idNum에 맞는 index에 저장하는 배열

    link_homonym: link_unhomonym의 저장한 link들을 similarities배열에서 cosine유사도가 큰 순서대로 저장한 배열
    """
    #best_match = None
    # vectorizer = TfidfVectorizer()
    original_text = ' '.join(original_text)
    # original_text = pre_text(original_text)
    # origin_transform = vectorizer.fit_transform([original_text])
    # original_vector = origin_transform.toarray()[0]
    link_unhomonym = []
    threadArr = []
    
    # def thread_function(link, original_vector, id, vectorizer):
    def thread_function(link, original_text, id, model):
        """
        위키피디아에서 단어 검색 결과물을 가져오는데 걸리는 시간이 다른 모든 작업보다 시간이 많이 걸려 thread를 사용하여 단어를 검색하고 그 결과를 상위 함수의 similarities배열에 저장하는
        방식으로 시간을 절약함

        ---argument---

        link: thread에게 전달된 하나의 link('word(id:??, ns:??)'로 구성된 str 변수)

        original_text: 검색을 요청한 웹 페이지에서 해당 단어가 사용된 문장을 모두 포함한 배열. 함수 내부에서 구분자 ' '를 활용한 str로 합쳐서 사용함 

        id: idNum과 같은 값으로 각 thread가 생성될 때, 1씩 늘어나는 값. similarities에 index로 사용

        model: hugging face의 bongsoo/albert-small-kor-sbert-v1 모델을 사용/ homonym_handler 폴더 내에 저장됨


        ---local variable---

        linkReader: 전달 받은 link의 위키피디아 페이지 정보를 저장한 객체

        link_summary: 위키피디아 페이지의 summary text
        """
        linkReader = WIKI.page(link)
        # link_text = linkReader.text
        # link_text = pre_text(link_text)
        # link_vector = vectorizer.transform([link_text]).toarray()[0]
        # similarity = cosine_similarity([original_vector], [link_vector])[0][0]
        
        # link_summary = linkReader.summary + "\n"
        # link_summary = link_summary.split('\n')[0]
        # link_summary = link_summary + '.'
        # link_summary = link_summary.split('.')[0]
        link_summary = linkReader.summary
        similarity = homonym_handling(model, original_text, link_summary)

        print(linkReader.title+"||"+str(similarity))
        similarities[id] = similarity

    for link in links:
        if '동음이의' in link or '동명이인' in link:
            continue
        else:
            link_unhomonym.append(link)
            
    similarities = [0.0]*len(link_unhomonym)
    idNum = 0    
    for link in link_unhomonym:    
        # thread = threading.Thread(target = thread_function, args = (link, original_vector, idNum, vectorizer))
        thread = threading.Thread(target = thread_function, args = (link, original_text, idNum, model))
        thread.start()
        threadArr.append(thread)
        idNum = idNum+1
    
    for thread in threadArr:
        thread.join()

    # best_match = link_unhomonym[similarities.index(max(similarities))]
    link_homonym = []
    while(len(link_unhomonym) != 0):
        link_homonym.append(link_unhomonym.pop(similarities.index(max(similarities))))
        similarities.pop(similarities.index(max(similarities)))
    return link_homonym

def re_search(wikiReader, original_text):
    """
    동음이의어 페이지가 존재할 때, 재검색을 위해 사용하는 함수

    ---argument---

    wikiReader: 검색 단어의 위키피디아 페이지정보를 저장한 객체

    original_text: 검색을 요청한 웹 페이지에서 해당 단어가 사용된 문장을 모두 포함한 배열

    ---local variable---

    best_match_text: hadle_homonym함수의 결과로 나온 배열의 첫번째 값(cosine 유사도가 가장 큰 값의 link('word(id:??, ns:??)'로 구성된 str 변수))
    """
    links = wikiReader.links
    link_homonym = handle_homonym(links, original_text)
    best_match_text = link_homonym.pop(0)
    result_page = WIKI.page(best_match_text)
    return result_page, link_homonym


def search_wiki(data):
    """
    위키피디아에 검색을 수행하고 검색 결과를 json으로 반환하는 함수
    동음이의어 체크 후, 동음이의어 일시 re_search진행
    위키피디아에 해당 페이지 정보가 없을 시, 알파벳을 소문자로 바꿔서 다시 검색
    그래도 페이지 정보가 없다면, 해당 페이지가 존재하지 않음을 나타내는 json 정보 반환
    
    ---argument---

    data: {text: '검색한 단어', usePara: '검색을 요청한 웹 페이지에서 해당 단어가 사용된 문장들의 배열'}로 구성

    ---local variable---

    wikiReader: 검색 단어의 위키피디아 페이지정보를 저장한 객체 
    """
    text = data['text']
    usePara = data['usePara']
    wikiReader = WIKI.page(text)
    link_homonym = []
    if(wikiReader.exists()):
        print(repr(wikiReader.text))
        if check_homonym(wikiReader):
            wikiReader, link_homonym = re_search(wikiReader, usePara)
        word = wikiReader.title
        summary = wikiReader.summary
        explain, related = get_text(wikiReader)
        result = wiki_data_json(word, summary, explain, related, link_homonym)
        return result
    elif(WIKI.page(text.lower()).exists()):
        wikiReader = WIKI.page(text.lower())
        if check_homonym(wikiReader):
            wikiReader, link_homonym = re_search(wikiReader, usePara)
        word = wikiReader.title
        summary = wikiReader.summary
        explain, related = get_text(wikiReader)
        result = wiki_data_json(word, summary, explain, related, link_homonym)
        return result
    else:
        return wiki_data_json(text, '해당 단어가 존재하지 않습니다.', '해당 단어가 존재하지 않습니다.', '해당 단어가 존재하지 않습니다.', link_homonym)

async def handle_request(request):
    """
    aiohttp 프레임 워크를 활용한 위키피디아 search 진행 코드
    """
    data = await request.json()
    data = data.get('request')
    return web.Response(text = search_wiki(data))

def crawl_text(url):
    """
    beautiful soup 모듈을 이용하여 검색을 요청한 웹 페이지의 모든 text내용물을 가져옴
    """
    response = requests.get(url)
    if response.status_code == 200:
        html = response.text
        soup = BeautifulSoup(html, 'html.parser')
        result = re.sub("\n+", "\n", soup.get_text())
        return result
    else:
        print(response.status_code)
        return 'error in crawl_text'

async def get_web_text(request):
    """
    aiohttp 프레임 워크를 활용한 웹 페이지 crawling 진행 코드
    """
    data = await request.json()
    data = data.get('request')
    print(data)
    return web.Response(text = crawl_text(data))

def main():
    """
    aiohttp 프레임 워크를 활용한 서버 구축
    """
    app = web.Application()
    app.router.add_post('/',handle_request)
    app.router.add_post('/get_text', get_web_text)
    web.run_app(app, host=ADDRESS, port=PORT)
    

if __name__ == "__main__":

    main()