/**
 * 버튼 클릭시, chrome플러그인의 service_worker에 select한 단어의 정의를 요청하는 함수
 */
function buttonClick() {
    let requestData = {text:selectText, usePara:textUsePara};
    chrome.runtime.sendMessage({request : requestData, action:"wikiSearchPanel"},function (response) {//sidePanel에서 정보를 요청하기에 wikiSearchPanel이벤트 요청
        if(response !== "error occurred") {
            deleteButton();
        }
    });
    selectText = '';
}

/**
 * 유저가 드래그한 단어 밑에 플러그인 버튼을 생성하는 함
 * @param {*} selectObj 유저가 드래그한 단어(Selection객체)가 포함된 HTML node
 */
function makeButton(selectObj) {
    let pluginButton = document.createElement("img");
    $(pluginButton).attr('src','../image/image_ready.png');
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
    document.body.appendChild(pluginButton);
}

/**
 * 검색 준비가 완료되면 플러그인 버튼의 이미지를 바꿈
 */
function changeButton() {
    $("#pluginButton").attr("src",'../image/image_done.png');
    $("#pluginButton").on("mousedown", buttonClick);
}

/**
 * 버튼을 없애는 함수
 */
function deleteButton() {
    $('#pluginButton').remove();
}

/**
 * 
 * @param {*} selectNode 유저가 드래그한 단어(Selection객체)가 포함된 HTML node
 * @param {*} textNodes  sidePanel의 p노드들의 모든 text들이 포함된 배열
 * @param {*} text 검색 요청한 단어
 * @returns sidePanel의 p노드의 text들 중 검색 요청한 단어가 포함된 text들의 배열
 */
function findUsePara(selectNode,textNodes, text) {
    let usePara = [];
    usePara.push(selectNode.trim());
    textNodes.forEach(function(textValue) {
        if(textValue.includes(text)) {
            usePara.push(textValue.trim());
        }
    });
    return usePara;
}

/**
 * 유저가 단어에 드래그를 했을 때, sidePanel내에서 해당 단어를 포함한 text들을 모두 가져오는 준비를 하는 함수
 */
function getTexts(){
    let selectObj = window.getSelection();
    let selectNode = selectObj.anchorNode.nodeValue;
    selectText = selectObj.toString().trim();
    
    if(selectText !== '' && selectText !== " " && selectText !== "\n") {
        makeButton(selectObj);
        let pNodes = $("p").get();
        let textNodes = []
        pNodes.forEach(function(pNode) {
            textNodes.push($(pNode).text());
        });
        textUsePara = findUsePara(selectNode, textNodes, selectText);
        changeButton();
    }
}

/**
 * loading screen을 띄움
 */
function loadingOn() {
    $("body").children().not($(".homonym")).not($(".related")).hide();
    $("#loading").show();
}

/**
 * loading이 완료된 뒤, loading screen을 내리고 준비된 정보를 표시함
 */
function loadingFin() {
    $("body").children().not($(".homonym")).not($(".related")).not($("#userInputDiv")).show();
    $("#loading").hide();
}

/**
 * 유저가 context-menu를 통해 검색을 요청했을 시, 띄울 창을 준비하는 함수
 */
function readyToType() {
    chrome.runtime.sendMessage({action: "isDrag"}, (response) => {//service-worker에 현재 유저가 context-menu로 플러그인을 열었는지 확인
        if(!response) { //drag로 sidePanel을 연게 아닌 것을 확인
            $("#loading").hide();
            $(".userText").show();
            $("#word").show();
            $("#history").show();
            $("#historyDiv").show();
            $("#deleteAllButton").show();
            $("#userInputDiv").show();
            $("#inputCancelButton").hide();
            $("#title").show();
            $("#logo").show();
        }
    })
    
}

function inputStart() {
    $("#userInputDiv").show();
    $("#inputStartButton").hide();
    $("#inputCancelButton").show();
    $("#wordDiv").hide();
}

function inputCancel() {
    $("#userInputDiv").hide();
    $("#inputStartButton").show();
    $("#inputCancelButton").hide();
    $("#wordDiv").show();
}

/**
 * 서버에서 전달한 json객체 중 explain부분의 정보를 가져와서 section별로 explainDiv 안에 표현하는 함수
 * @param {*} explain 서버에서 전달한 json객체 중 explain부분의 정보를 가진 배열
 */
function displayExplain(explain) {
    for (let val of explain) {
        sectionDept = val[0]
        sectionTitle = val[1]
        sectionText = val[2]
        let header = document.createElement('H'+sectionDept);
        $(header).addClass("selectable"); //selectable 속성을 추가(이 속성이 있어야 단어에 드래그 했을 때, 버튼을 생성함)
        let titleText = document.createTextNode(sectionTitle);
        header.appendChild(titleText);
        let textP = document.createElement('P');
        $(textP).addClass("selectable");
        let textText = document.createTextNode(sectionText);
        textP.appendChild(textText);
        explainDiv.appendChild(header);
        explainDiv.appendChild(textP);
    }
    MathJax.typeset(); //explain을 작성한 후, MathJax에게 Latex문법 rendering을 진행하게 함

}

/**
 * related, homonym, history 부분의 텍스트에 하이퍼링크를 클릭시 server에 검색요청을 수행하도록 함
 * @param {*} event 클릭 이벤트가 일어난 객체에 대한 정보를 가짐
 * @param {*} data 검색을 요청하는 데이터({text, usePara})
 */
function hyperLinkClick(event, data) {
    event.preventDefault(); // Prevent the default link behavior
    chrome.runtime.sendMessage({ request: data, action: "wikiSearchPanel" });
};

/**
 * server의 data중 related부분의 link('word(id:??, ns:??'형식의 str)를 하이퍼 링크로 만드는 함수
 * @param {*} relatedLinks server가 전송한 data 중 related 정보(위키피디아 페이지의 '같이 보기' section의 link들 중 내용이 존재하는 link들의 배열)
 * @returns 하이퍼 링크의 형식을 가진 link들의 배열(형식만 갇춘 str)
 */
function getTextAfter(relatedLinks) {
    let textAfter = []
    relatedLinks.forEach(link => {
        let text = "<a href='#'>"+link+"</a>";
        textAfter.push(text);
    });
    
    return textAfter;
}

/**
 * server의 data중 related부분의 내용을 sidePanel의 relatedDiv에 표기하는 함수
 * @param {*} relatedLinks server가 전송한 data 중 related 정보(위키피디아 페이지의 '같이 보기' section의 link들 중 내용이 존재하는 link들의 배열)
 */
function displayRelated(relatedLinks) {
    if(relatedLinks != 'none' && relatedLinks != '해당 단어가 존재하지 않습니다.') { //related의 내용이 존재하는지 확인 
        $(".related").show(); //내용이 존재할 때만 relatedDiv를 표시
        
        let pNodes = $("p").get();
        let pNodesText = [];
        pNodes.forEach(function(pNode) { //sidePanel의 모든 p node들의 text를 가져옴(검색 요청을 위해)
            pNodesText.push($(pNode).text());
        });
        let textAfter = getTextAfter(relatedLinks)
        textAfter.forEach(text => {
            let li = document.createElement('LI');
            $(li).html(text); //text형식의 하이퍼 링크들을 실제로 html화 시킴
            relatedList.appendChild(li);
        });
        let relatedListAs = $(relatedList).find('a'); //html화 이후 링크들을 모은 배열을 얻음
        for(let relatedA of relatedListAs) { //각 링크에 클릭 이벤트 설정
            let related = $(relatedA).text(); //링크의 innerText(검색 요청을 위해)
            let data = {text: related, usePara: pNodesText}; //검색 데이터 생성
            relatedA.addEventListener('click', (event) => {
                hyperLinkClick(event, data);
            });
        }
    }
}

/**
 * service-worker에서 받아온 searchHistory를 표시하는 함수
 * @param {*} history service-worker의 searchHistory를 저장한 배열
 */
function displayHistory(history) {
    console.log("Received history:", history);  // 로그 추가
    historyList.innerHTML = ''; //초기화
    history.forEach(hist => {
        let word = hist.text
        let li = document.createElement('LI');
        let spanLink = document.createElement('span');
        let imageX = document.createElement('img');

        $(imageX).attr('src', '../image/x_icon.png');

        $(imageX).addClass('delButton'); //history제거 버튼 생성
        imageX.addEventListener('click', delHistory)

        let link = document.createElement('a'); //각 history의 클릭 이벤트 설정
        link.href = '#';
        link.innerText = word;
        link.addEventListener('click', (event) => {
            hyperLinkClick(event, hist);
        });

        spanLink.appendChild(link);
        li.appendChild(spanLink);
        li.appendChild(imageX);
        historyList.appendChild(li);
    });
}

/**
 * 동음이의어 검색이 진행되었을 때, 해당 동음이의어 정보를 표시하는 함수
 * @param {*} link_homonym server에서 동음이의어 페이지 처리를 했을 때, 동음이의어들의 link('word(id:??, ns:??'형식의 str)들을 가진 배열
 */
function displayHomonym(link_homonym) {
    if(link_homonym.length != 0) {
        $(".homonym").show();
        for(let link of link_homonym) { //모든 동음이의어 링크에 대해서 클릭 이벤트를 설정함
            let linkLi = document.createElement('LI');
            let hyperLink = document.createElement('a');
            hyperLink.href = '#';
            hyperLink.innerText = link;
            let data = {text:link, usePara:[]} //동음이의어에 대한 usePara가 현재 sidePanel에 존재하지 않으므로 usePara를 빈 배열로 설정
            hyperLink.addEventListener('click',(event) => {
                hyperLinkClick(event, data);
            });
            linkLi.appendChild(hyperLink);
            homonymList.appendChild(linkLi);
        }
    }
}

/**
 * service-worker에 searchHistory를 요청하는 함수
 */
function getHistory() {
    chrome.runtime.sendMessage({ action: "getHistory" }, (history) => {
        displayHistory(history); //받은 searchHistory를 표기
    });
}

/**
 * service-worker에 유저가 삭제하고자 하는 history를 삭제 요청하는 함수
 * @param {*} event 클릭 이벤트가 실행된 객체
 */
function delHistory(event) {
    let targetButton = event.target;
    let history = $(targetButton).prev().children().eq(0).text(); //이벤트 타겟과 같은 부모(li node)를 가진 link('word(id:??, ns:??'형식의 str)의 text를 가져옴
    $(targetButton).parent().remove(); //부모 삭제(li node)
    chrome.runtime.sendMessage({action: "delHistory", request: history}); //삭제 요청
}

/**
 * service-worker에 모든 history를 삭제 요청하는 함수
 */
function delAllHistory() {
    chrome.runtime.sendMessage({action: "delAllHistory"});
    $("#historyList").empty();
}

/**
 * server의 검색 결과를 sidePanel에 표시하는 함수
 * @param {*} json_data server에서 검색한 결과를 json화 시킨 데이터
 */
function putDataInDiv(json_data) {
    $(".homonym").hide(); //먼저 초기화를 진행
    $(".related").hide();
    $("#userTextInput").val("");

    data = JSON.parse(json_data);

    wordDiv.innerText = data.word; //wordDiv 설정

    let summaryP = document.createElement('p'); //summaryDiv 설정
    $(summaryP).addClass('selectable');
    let summaryText = document.createTextNode(data.summary);
    summaryP.appendChild(summaryText);
    summaryDiv.appendChild(summaryP);
    
    let explainStr = data.explain; //explainDiv 설정
    displayExplain(explainStr);
    
    let relatedLinks = data.related; //relatedDiv 설정
    relatedList.innerHTML = ''; // Clear the previous related list
    displayRelated(relatedLinks);
    
    getHistory(); //historyDiv 설정
    
    let homonymList = data.link_homonym; //homonymDiv 설정
    displayHomonym(homonymList);
    
    $(".selectable").on("mouseup", getTexts); //모든 selectable Class 를 가진 객체에 드래그 이벤트 설정

    loadingFin(); // 준비 완료 후 표시
}


/**
 * sidePanel의 구성 Div들을 초기화하는 함수
 */
function clearDataDiv() {
    wordDiv.innerText = "";
    summaryDiv.replaceChildren();
    explainDiv.replaceChildren();
    relatedList.replaceChildren();
    homonymList.replaceChildren();
}

/**
 * 유저가 입력한 단어를 server에 검색 요청하는 함수
 * @param {*} text 유저가 입력창에 입력한 검색하고자 하는 단어
 */
function userTypeSearch(text) {
    usePara = []; //해당 단어의 정보가 sidePanel에 없기에 빈 배열로 설정
    data = {text: text, usePara: usePara}
    chrome.runtime.sendMessage({ request: data, action: "wikiSearchPanel" });
}

/**
 * 유저가 입력한 단어를 입력창에서 가져오는 함수
 */
function getSearchText(){
    let text = $("#userTextInput").val().trim();
    if(text != "") {
        userTypeSearch(text);
    }
}

/**
 * 유저의 엔터키 입력 이벤트를 처리하는 함수
 * @param {*} event 유저의 키 입력 이벤트의 정보를 가진 객체
 */
function enterKeySearchText(event) {
    if(event.keyCode == 13) { //입력이 enter키라면
        let text = $("#userTextInput").val().trim();
        if(text != "") { //입력창의 내용물이 비어 있지 않다면
            userTypeSearch(text);
        }
    }
}

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) { //sidePanel의 플러그인 이벤트 리스너 설정
    if(request.action === "fill") { //정보를 채우라는 요청 이벤트
        let message = request.request;
        clearDataDiv();
        putDataInDiv(message);
    }else if(request.action === "loading") { //로딩창을 띄우라는 요청 이벤트
        $(".homonym").hide();
        $(".related").hide();
        loadingOn();
    }
    return true; //비동기 처리 설정
});

loadingOn(); //sidePanel이 열리면 먼저 loading창부터 띄움

getHistory(); //이전에 검색한 history를 가져옴

let selectText = ''; //sidePanel에서 검색하기 위해 drag한 단어를 저장하는 변수
let textUsePara = []; //sidePanel의 p노드들 중 검색을 요청한 단어를 사용한 p노드들의 text를 저장하는 배열

let wordDiv = document.getElementById('wordDiv'); //변수 설정
let summaryDiv = document.getElementById('summaryDiv');
let explainDiv = document.getElementById('explainDiv');
let relatedList = document.getElementById('relatedList');
let historyList = document.getElementById('historyList');
let homonymList = document.getElementById("homonymList");
let userTextInput = document.getElementById("userTextInput");
let textSendButton = document.getElementById("textSendButton");
let allHistoryDelete = document.getElementById("deleteAllButton");
let inputStartButton = document.getElementById("inputStartButton");
let inputCancelButton = document.getElementById("inputCancelButton");

userTextInput.addEventListener('keypress', enterKeySearchText); //이벤트 리스너 설정
textSendButton.addEventListener('click', getSearchText);
allHistoryDelete.addEventListener('click', delAllHistory);
inputStartButton.addEventListener('click', inputStart);
inputCancelButton.addEventListener('click', inputCancel);

$('body').on('mousedown', deleteButton); //sidePanel의 모든 node들을 클릭할 시 button을 삭제하도록 함

$(document).ready(readyToType()); //모든 준비가 완료되면 어떤 화면을 띄워야 될지 확인