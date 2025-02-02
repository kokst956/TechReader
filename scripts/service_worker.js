let searchOutcome = ""; //검색 결과를 저장하여 사용하는 global 변수
let isDrag = false; //유저가 sidePanel을 연 방식을 저장하는 global 변수
let searchHistory = []; //local storage에 저장된 searchHistory를 코드에서 사용하기 위해 저장한 global 변수
const url = 'http://3.131.214.93:8888/' //서버의 ipv4 주소(현재는 gateway로 설정 - 이후 서버를 구하면 그 주소를 사용)

chrome.storage.local.get(['searchHistory']).then((result) => { //플러그인이 시작할 때, chrome의 local storage에서 searchHistory가 존재하면 가져옴
                                                               //플러그인 환경에서 Storage.localStorage에 접근이 불가하기에 사용
    if(result.searchHistory !== undefined) {
        searchHistory = result.searchHistory;
    }
});

/**
 * searchHistory에 저장할 history json객체를 만듦
 * @param {*} response 서버에 요청한 검색 결과를 저장한 변수
 * @param {*} request 유저가 검색을 요청한 정보를 저장한 변수
 * 
 * @return {history} searchHistory에 저장될 json 객체({text, usePara})
*/
function makeHistory(response, request) {
    responseParse = JSON.parse(response);
    word = responseParse.word;
    history = {text: word, usePara: request.request.usePara};
    return history;
}

chrome.contextMenus.onClicked.addListener((info, tab) => { //아래에서 만든 context-menu가 클릭되는 이벤트의 listener설정(sidePanel을 엶)
    if(info.menuItemId === "wikiSearcher") {
        chrome.sidePanel.open({ tabId: tab.id });
        isDrag = false; //isDrag는 유저가 플러그인을 단어에 드래그 해서 열었는 지 여부를 저장하는 변수
    }
});

chrome.runtime.onInstalled.addListener(()=> { //플러그인이 처음 설치될 때, 플러그인에서 사용할 context-menu button을 만듦
    chrome.contextMenus.create({
        title: "wikiSearcher",
        id: 'wikiSearcher'
        }
    );
});


chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {//service-worker의 이벤트 리스너 모음
    let message = { request: request.request };
    if (request.action === "wikiSearch") { //wikiSearch 이벤트 - 유저가 웹 페이지에서 단어에 드래그를 하여 검색 요청
        isDrag = true;
        chrome.runtime.sendMessage({action: 'loading'}); //sidePanel에 loading이벤트 요청(sidePanel이 닫혀있을 때는 수신을 하지 못해 넘어감) 검색 결과가 나올때 까지는 로딩창을 유지
        chrome.sidePanel.open({ tabId: sender.tab.id });
        postData(url, message).then((response) => { // 서버에 단어 검색 요청
            if (typeof(response) === 'string') {
                sendResponse(response); //검색 결과를 검색을 요청한 함수에 보냄(비동기 통신에서 결과를 받은 후에 동작하게 하기 위함)
                searchOutcome = response;
                history = makeHistory(response, request);
                addToSearchHistory(history);
                chrome.runtime.sendMessage({ request: searchOutcome, action: "fill" }); //sidePanel에 제공한 정보로 내용을 채울 것을 요청
            } else {
                sendResponse("error occurred in service-worker");
            }
        }).catch((error) => {
            sendResponse("error occurred");
        });

    } else if(request.action === "get_text") { //검색 요청 페이지의 crawling 요청 이벤트
        postData(url+'/get_text', message).then((response) => { //서버에 crawling 요청
            sendResponse(response)
        });

    } else if (request.action === "getHistory") { //searchHistory를 요청하는 이벤트
        console.log("Sending history:", searchHistory);  // 로그 추가
        sendResponse(searchHistory); //요청자에게 searchHistory를 보냄

    } else if(request.action === "wikiSearchPanel") { //sidePanel에서 서버에 검색을 요청하는 이벤트
        chrome.runtime.sendMessage({action: "loading"}); //sidePanel에 loading 이벤트 요청(검색 결과가 나올때 까지는 로딩화면을 유지)
        postData(url, message).then((response) => { //이후는 isDrag 변수의 갱신이 없다는 점을 제외하면 wikiSearch이벤트와 동일함
            if (typeof(response) === 'string') {
                searchOutcome = response;
                history = makeHistory(response, request);
                addToSearchHistory(history);
                chrome.runtime.sendMessage({ request: searchOutcome, action: "fill" });
            } else {
                sendResponse("error occurred in service-worker");
            }
        }).catch((error) => {
            sendResponse("error occurred");
        });

    }else if(request.action == "isDrag") { //현재 sidePanel을 열때, 드래그 검색을 사용한 것인지 확인하는 이벤트
        sendResponse(isDrag);

    }else if(request.action == 'delHistory') { //sidePanel에서 유저가 선택한 history를 searchHistory에서 제거하는 함수 
        let delTargetHist = request.request;
        searchHistory = searchHistory.filter((history) => history.text !== delTargetHist); //요청 단어를 searchHistory에서 걸러냄
        chrome.storage.local.set({'searchHistory': searchHistory}, function() { //searchHistory 갱신
            console.log(searchHistory);
        });

    }else if(request.action == "delAllHistory") { //searchHistory를 완전 초기화하는 이벤트
        chrome.storage.local.clear();
        searchHistory = [];
    }

    return true;
});

/**
 * 검색 내역을 추가하는 코드
 * @param {*} history searchHistory에 새로 추가할 history
 */

function addToSearchHistory(history) {
    const includesArray = (hist, comp) => { //현재 history가 searchHistory의 구성품과 중복되는지 검사
        return hist.some(item => item.text === comp.text);
    }

    if (!includesArray(searchHistory,history)) {//중복되지 않는다면 searchHistory에 추가하고, local storage를 갱신
        searchHistory.push(history);
        chrome.storage.local.set({'searchHistory': searchHistory}, function() {});
    }
}

/**
 * 검색을 위해 fetch를 사용해 서버에 정보를 전달함
 * @param {*} url 서버의 ipv4 주소
 * @param {*} data 서버에 검색을 요청할 정보({text, usePara}})
 * @returns 검색 결과의 text 데이터
 */
async function postData(url = "", data = {}) {
    const response = await fetch(url, {
        method: "POST",
        mode: "cors",
        cache: "no-cache",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        redirect: "follow",
        referrerPolicy: "no-referrer",
        body: JSON.stringify(data),
    });
    
    return response.text();
    
}
