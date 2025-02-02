let body = document.getElementsByTagName("body")[0]; // DOM의 body를 가져옴

let selectText = ''; // 유저가 드래그(user-select)한 단어가 들어갈 공간
let textUsePara = [];

$(body).on("mouseup", getTextNode); // 플러그인 실행을 위한 버튼을 생성하는 이벤트리스너
$(body).on("mousedown", deleteButton); // 외부 클릭 시(user-select취소) 박스를 없애는 이벤트리스너

/**
 * 유저가 웹페이지에서 드래그한 단어 밑에 버튼을 생성하는 함수
 * @param {*} selectObj 유저가 드래그한 단어정보를 가진 Selection 객체
 */
function makeButton(selectObj) {
    let pluginButton = document.createElement("img");
    pluginButton.src = chrome.runtime.getURL('image/image_ready.png');
    $(pluginButton).attr('id',"pluginButton");
    //chatGPT 생성 코드
    const range = selectObj.getRangeAt(0);
    const rect = range.getBoundingClientRect();
        
    pluginButton.style.position = 'absolute';
    pluginButton.style.left = `${rect.left}px`;
    pluginButton.style.top = `${rect.bottom + window.scrollY}px`;
    pluginButton.style.color = 'black'
    pluginButton.style.width = '30px'
    pluginButton.style.height = '30px'
    //
    document.body.appendChild(pluginButton)
}

/**
 * 서버에서 검색 준비가 완료되었을 때, 플러그인 버튼의 이미지를 바꾸고, 클릭 이벤트 리스너를 설정하는 함수
 */
function changeButton() {
    $("#pluginButton").attr("src",chrome.runtime.getURL('image/image_done.png'));
    $("#pluginButton").on("mousedown", buttonClick);
}

/**
 * 
 * @param {*} selectNode 유저가 드래그한 단어(Selection객체)가 포함된 HTML node
 * @param {*} textNodes 검색 요청한 웹 페이지를 crawling하여 얻은 모든 문장들이 포함된 배열
 * @param {*} text 검색 요청한 단어
 * @returns 검색 요청한 웹 페이지에서 요청한 단어를 사용한 모든 문장들의 배열
 */
function findUsePara(selectNode,textNodes, text) {
    let usePara = [];
    usePara.push(selectNode.trim());
    let allTexts = textNodes.split('\n');
    console.log(allTexts);
    allTexts.forEach(function(textValue) {
        if(textValue.includes(text)) {
            usePara.push(textValue.trim());
        }
    });
    return usePara;
}

/**
 * 유저가 드래그한 단어(Selection객체)를 가져오고 웹 페이지에서 해당 단어가 사용된 문장을 가져오기 위해 서버에 crawling을 요청
 */
function getTextNode() {
    let textNodes = "";
    let url = window.location.href;
    let selectObj = window.getSelection();
    let selectNode = selectObj.anchorNode.nodeValue; //드래그 한 단어가 포함된 HTML node를 가져옴
    selectText = selectObj.toString().trim(); //선택한 단어를 가져옴
    
    console.log(selectNode);
    if(selectText !== '' && selectText !== " " && selectText !== "\n") { //선택한 단어가 비어있지 않는지 확인
        makeButton(selectObj);
        chrome.runtime.sendMessage({request : url, action : 'get_text'}, function(response) {
            textNodes = response;
            getUserSelectText(selectNode ,textNodes);
        });
        
    }
}

/**
 * 
 * @param {*} selectNode 유저가 드래그 한 단어(Selection 객체)가 포함된 HTML node
 * @param {*} textNodes 검색 요청한 웹 페이지를 crawling하여 얻은 모든 문장들이 포함된 배열
 */
function getUserSelectText(selectNode,textNodes) {
    textUsePara = findUsePara(selectNode, textNodes, selectText);
    changeButton();
}

/**
 * 버튼 클릭시, chrome플러그인의 service_worker에 select한 단어의 정의를 요청하는 함수
 */
function buttonClick() {
    let requestData = {text:selectText, usePara:textUsePara};
    console.log(textUsePara);
    chrome.runtime.sendMessage({request : requestData, action:"wikiSearch"},function (response) {
        if(response !== "error occurred") {
            deleteButton();
        }
    });
}

/**
 * 플러그인 버튼을 없애는 함수
 */
function deleteButton() {
    $('#pluginButton').remove();
}