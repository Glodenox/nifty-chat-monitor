// ==UserScript==
// @name           Nifty Chat Monitor
// @namespace      http://somewhatnifty.com
// @description    reformats twitch chat for display on a chat monitor
// @match        https://www.twitch.tv/popout/*/chat?display*
// @match        https://www.twitch.tv/*/chat?display*
// @version    0.304
// @updateURL https://raw.githubusercontent.com/paul-lrr/nifty-chat-monitor/master/chat-monitor.user.js
// @downloadURL https://raw.githubusercontent.com/paul-lrr/nifty-chat-monitor/master/chat-monitor.user.js
// @require  https://ajax.googleapis.com/ajax/libs/jquery/3.2.1/jquery.min.js
// @require  https://gist.github.com/raw/2625891/waitForKeyElements.js
// @grant       GM_getResourceText
// @grant       GM_addStyle
// @require  https://raw.githubusercontent.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_log
// @resource material-icons https://fonts.googleapis.com/icon?family=Material+Icons
// ==/UserScript==

// Redirect to new layout if we find the old layout
if (document.querySelector('.ember-application')) {
    window.location = window.location.href.replace('twitch.tv', 'twitch.tv/popout');
}

let getQS = (str)=>{
    let a, q = {},r = /([^?=&\r\n]+)(?:=([^&\r\n]*))?/g;
    while ((a = r.exec(str)) !== null) {
        q[a[1]] = a[2]||'';
    }
    return q;
};

var qs = getQS(location.search);

var inlineImages = false;

//Create config page fields
//Fields appear in the order written below.
//Maybe in the future this could be loaded from a JSON file? It would be easier to maintain.
var configFields = {
    "HideChatInput": { //Id for field in html
        "label" : "Hide Chat Input Area", //Label that appears on the config
        "type" : "checkbox",
        "default" : true
    },
    "ReverseDirection": {
        "label" : "New messages appear on top",
        "type" : "checkbox",
        "default" : true
    },
    "InlineImages": {
        "label" : "Display images that are linked",
        "type" : "checkbox",
        "default" : true
    },
    "SmoothScroll": {
        "label": "Make new messages slide in smoothly (only works when messages appear on top)",
        "type": "checkbox",
        "default": true
    },
    "SmoothScrollSpeed": {
        "label": "Time needed for a new message to slide in (seconds)",
        "type": "float",
        "default": "1"
    },
    "GroupSimilarMessages": {
        "label": "Group together messages that are practically the same, showing a counter for each added message",
        "type": "checkbox",
        "default": true
    },
    "MoveGroupedMessagesToTop": {
        "label": "Move grouped messages to the top",
        "type": "checkbox",
        "default": false
    },
    "UsernamesToHighlight": {
        "label" : "Username(s)",
        "section" : ["Username Highlighting", "Change the color of any of the usernames listed below. Separate with commas"],
        "type" : "text",
        "title" : "seperate usernames with commas, case sensitive",
        //These as defaults as I can't imagine Paul will mind, and I know I don't mind.
        "default" : "ThingsOnMyStream, cheetoJack"
    },
    "UsernameHighlightingColor": {
        "label" : "Highlight Color",
        "type" : "text",
        "default" : "#ff6696" //Its pink. Its a good color bront.
    },
    "KeywordsToHighlight": {
        "label" : "Keyword(s)",
        "section" : ["Keyword Highlighting", "Change the background color of any messages that use the keywords listed below. Separate with commas"],
        "type" : "text",
        "title" : "seperate keywords with commas, case sensitive",
        "default" : ""
    },
    "KeywordHighlightingBackgroundColor": {
        "label" : "Highlight Background Color",
        "type" : "text",
        "default" : "#560b33" //Its also pink.
    },
    "CustomHighlighting": {
        "label" : "",
        "section" : ["CSS User Highlighting"],
        "type" : "textarea",
        //Keeping CSS in from chat-monitor-highlight.css as an example of what you can do
        "default" : ".chat-line__message[data-badges*='Moderator'] .chat-author__display-name {\n" +
                        "\tcolor: #8383f9 !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-badges*='Broadcaster'] {\n" +
                        "\tbackground-color: #000090 !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-badges*='Broadcaster'] .chat-author__display-name {\n" +
                        "\tcolor: #00b5e0 !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-user='LRRbot'] .chat-author__display-name {\n" +
                        "\tcolor:purple !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-user='LRRbot'][data-message*='thanks for']{\n" +
                        "\tbackground-color:purple !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-user='LRRbot'][data-message*='thanks for'] .chat-author__display-name{\n" +
                        "\tcolor:black !important;\n" +
                    "}\n" +
                    ".chat-line__message[data-message*='loadingreadyrun'] {\n" +
                        "\tbackground-color: #00005d !important;\n" +
                    "}"
    },
    "RefreshReminder": {
        "label": "",
        "section" : ["After saving, be sure to refresh the page to have your new settings apply!"],
        "type" : "hidden"
    }
};
var scrollDistance = 0,
    scrollReference = +new Date();

initConfig();
var MESSAGE_CONTAINER = '.chat-list .tw-full-height';
waitForKeyElements(MESSAGE_CONTAINER, onChatLoad);
var twitterScript = document.createElement("script");
twitterScript.type = "text/javascript";
twitterScript.src = "https://platform.twitter.com/widgets.js";
document.body.appendChild(twitterScript);

function onChatLoad() {
    loadSettings();
    actionFunction();
}

//Creates , inits the config handler
//See https://github.com/sizzlemctwizzle/GM_config/wiki for details
function initConfig() {
    GM_config.init({
        "id" : "chat-config",
        "title" : "Nifty Chat Monitor Settings",
        "fields" : configFields,
        // I need a better way of settings this css attribute. I'm thinking of converting
        // it to a variable, because I could use new lines in that and keep it somewhere
        // out of sight, but thats for later-Jack
        "css" : "#chat-config .field_label { font-size: 32px !important; line-height: 35px !important; font-family: 'Open Sans Condensed', sans-serif !important; font-weight: normal !important; } .config_var input[type=checkbox] {  transform: scale(2.0); } #chat-config_field_CustomHighlighting { width: 90%; height: 500px; }" //adds CSS to the config page
    });
}

//Checks all config options and loads them appropriately
function loadSettings() {
    //Add settings wheel to page
    $('.chat-list').append("<div id=\"settings-wheel\"> <i class=\"material-icons\">settings</i> </div>");
    $('#settings-wheel').click(function() {
        GM_config.open();
    });

    //Reverse messages
    if(typeof qs.reverse !== 'undefined' || GM_config.get("ReverseDirection")) {
        document.querySelector(MESSAGE_CONTAINER).classList.add('reverse');
    }

    //Hide chat interface
    if(GM_config.get("HideChatInput")) {
        document.querySelector('.chat-input').classList.add('tw-hide');
    }

    //Check if we should be adding inline images or not
    if(typeof qs.img !== 'undefined' || GM_config.get("InlineImages")) {
        inlineImages = true;
    }

    //Handles UsernamesToHighlight, UsernameHighlightingColor, CustomHighlighting config fields
    addCssFromConfig(generateCss());
}

//Adds the CSS from the config fields
//generatedCss will be added to the CSS on the page.
function addCssFromConfig(generatedCss) {
    //Add CSS from text area
    var customHighlighting = GM_config.get("CustomHighlighting");
    var head = document.getElementsByTagName("head")[0];
    var newCss = document.createElement("style");
    newCss.type = "text/css";
    newCss.innerHTML = generatedCss + "\n" + customHighlighting;
    head.appendChild(newCss);
}

//Creates CSS from config fields
function generateCss() {
    //Stores CSS generated by various options
    var generatedCss = "";
    generatedCss += generateUsernameHighlightingCss();
    generatedCss += generateKeywordHighlightingCss();
    return generatedCss;
}

//Handles UsernamesToHighlight section, returns CSS as a string
function generateUsernameHighlightingCss() {
    var generatedCss = "";
    //Load config options, Check if contains data
    var usernamesToHighlight = GM_config.get("UsernamesToHighlight");
    var usernameHighlightColor = GM_config.get("UsernameHighlightingColor");
    if(usernamesToHighlight && usernameHighlightColor) {
        //Split into array on commas
        var usernameList = usernamesToHighlight.split(",");
        //Adds rule for each username. This could just add one rule, and save a bit of space, but I think this works just as well.
        for(var i = 0; i < usernameList.length; i++) {
            //Add css to variable
            generatedCss += ".chat-line__message[data-user=\"" + usernameList[i].trim() + "\"] .chat-author__display-name {\n\tcolor: " + usernameHighlightColor + " !important;\n }\n";
        }
    }
    return generatedCss;
}

//Handles KeywordsToHighlight section, returns CSS as a string
function generateKeywordHighlightingCss() {
    var generatedCss = "";
    //Load config options, Requires either Text or Background color, but not both
    //data-message attribute makes everything lowercase, so we do the same to our keywords.
    var keywordsToHighlight = GM_config.get("KeywordsToHighlight").toLowerCase();
    var keywordHighlightBackgroundColor = GM_config.get("KeywordHighlightingBackgroundColor");
    if(keywordsToHighlight && keywordHighlightBackgroundColor) {
        //Split into array on commas
        var keywordList = keywordsToHighlight.split(",");
        //Adds rule for each username. This could just add one rule, and save a bit of space, but I think this works just as well.
        for(var i = 0; i < keywordList.length; i++) {
            //Add css to variable
            generatedCss += ".chat-line__message[data-message*=\"" + keywordList[i] + "\"] {\n";
            generatedCss += "\tbackground-color: " + keywordHighlightBackgroundColor + " !important;\n";
            generatedCss += "}\n";
        }
    }
    return generatedCss;
}

var threeQuarterOfWindow = (window.innerHeight || document.documentElement.clientHeight) * 0.75;
window.addEventListener('resize', () => {
    threeQuarterOfWindow = (window.innerHeight || document.documentElement.clientHeight) * 0.75;
});
// Check whether an element is visible in the top 75% of the screen
function inView(el) {
    return el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().bottom <= threeQuarterOfWindow;
}

function actionFunction() {
    //add keyboard command and element to hide chat
    $('body').keydown((e)=>{
        if(e.key=="H" && e.shiftKey && e.ctrlKey){
            e.preventDefault();
            $('#hide').toggle();
        }
    });
    $('<div id="hide" />').html('Chat Hidden<br/><br/><br/>Ctrl-Shift-H to Show').hide().appendTo('body');
    // The node to be monitored
    var target = document.querySelector(MESSAGE_CONTAINER);

    // The div containing the scrollable area
    var chatContentDiv = target.parentNode.parentNode;
    // Repository that can contain recent message 'slugs' to compare with
    var messageRepository = function() {
        var queue = [];
        return {
            'find': function(slug, message) {
                var idx = queue.findIndex((obj) => obj.slug == slug);
                if (idx < 0) {
                    queue.unshift({
                        slug: slug,
                        message: message
                    });
                    for (var i = queue.length - 1; i >= 0 && !inView(queue[i].message); i--) {
                        queue.pop();
                    }
                } else if (GM_config.get("MoveGroupedMessagesToTop")) {
                    queue.unshift(queue.splice(idx, 1)[0]);
                    idx = 0;
                }
                return queue[idx] && queue[idx].message;
            }
        }
    }();
    // Create an observer instance
    var observer = new MutationObserver(function( mutations ) {
        mutations.forEach(function( mutation ) {
            var newNodes = mutation.addedNodes; // DOM NodeList
            if( newNodes !== null ) { // If there are new nodes added
                newNodes.forEach(function(newNode) {
                    if (newNode.nodeType == Node.ELEMENT_NODE) {
                        // Ignore the move of a message group
                        if (newNode.classList.contains('message-group')) {
                            return;
                        }
                        // Add the newly added node's height to the scroll distance and reset the reference distance
                        newNode.dataset.height = newNode.scrollHeight;
                        scrollReference = scrollDistance += newNode.scrollHeight;

                        if (!newNode.classList.contains('chat-line__message')) { // Only treat chat messages
                            return;
                        }

                        newNode.classList.toggle('odd', newNode.previousElementSibling.classList.contains('odd') == newNode.previousElementSibling.classList.contains('tw-hide'));
                        // Add the generated "slug" of the message and compare for grouping
                        if (GM_config.get("GroupSimilarMessages")) {
                            var slug = "";
                            newNode.querySelectorAll('.text-fragment,img.chat-image').forEach((el) => slug += el.alt || el.textContent.toLowerCase());
                            slug = slug.replace(/[^a-zA-Z0-9:()]/g, '');
                            var matchedMessage = messageRepository.find(slug, newNode);
                            if (matchedMessage && !matchedMessage.classList.contains('message-group')) {
                                matchedMessage.classList.add('message-group');
                                var counterContainer = document.createElement('span'),
                                    counter = document.createElement('span');
                                counter.textContent = "1";
                                counterContainer.innerHTML = '&times; ';
                                counterContainer.className = 'counter';
                                counterContainer.appendChild(counter);
                                matchedMessage.insertBefore(counterContainer, matchedMessage.childNodes[0]);
                                matchedMessage.counter = counter;
                            }
                            if (newNode != matchedMessage && matchedMessage && matchedMessage.parentNode) {
                                scrollReference = scrollDistance -= newNode.dataset.height;
                                newNode.classList.add('tw-hide');
                                if (GM_config.get("MoveGroupedMessagesToTop")) {
                                    var nextMessage = matchedMessage.nextElementSibling;
                                    matchedMessage.parentNode.appendChild(matchedMessage);
                                    while (nextMessage != null) {
                                        nextMessage.classList.toggle('odd');
                                        nextMessage = nextMessage.nextElementSibling;
                                    }
                                    // make it odd if the previous entry was even and visible (XOR comparison)
                                    matchedMessage.classList.toggle('odd', matchedMessage.previousElementSibling.classList.contains('odd') == matchedMessage.previousElementSibling.classList.contains('tw-hide'));
                                }
                                matchedMessage.counter.textContent++;
                                matchedMessage.counter.parentNode.classList.add('bump');
                                setTimeout(() => matchedMessage.counter.parentNode.classList.remove('bump'), 150);
                                return; // newNode has been swallowed, no need to process any further
                            }
                        }

                        //add data-user=<username> for user-based highlighting
                        newNode.dataset.user = newNode.querySelector('.chat-author__display-name').textContent;

                        //add data-badges=<badges> for badge-based highlighting
                        var badges = [];
                        newNode.querySelectorAll("img.chat-badge").forEach(function(badge){
                            badges.push(badge.alt);
                        });
                        newNode.dataset.badges = badges.join(',');

                        //add data-message=<message> for keyword-based highlighting
                        var message = newNode.querySelector("span[data-a-target='chat-message-text']");
                        if (message) {
                            newNode.dataset.message = message.textContent.replace(/(\r|\s{2,})/gm," ").trim().toLowerCase();
                        } else if (newNode.querySelector('.chat-image')) {
                            newNode.dataset.message = 'Emote: ' + newNode.querySelector('.chat-image').alt;
                        }

                        //add inline images
                        if(inlineImages) {
                            newNode.querySelectorAll('.chat-line__message > a').forEach(function(link) {
                                var re = /(.*(?:jpg|png|gif|jpeg))$/mg;
                                if (re.test(link.textContent)){
                                    link.innerHTML = '<img src="'+link.textContent.replace("media.giphy.com", "media1.giphy.com")+'" alt="'+link.textContent+'"/>';
                                }
                                var match = /^https?:\/\/giphy\.com\/gifs\/(.*-)?([a-zA-Z0-9]+)$/mg.exec(link.textContent);
                                if (match) {
                                    var imageUrl = "https://media1.giphy.com/media/" + match[2].split("-").pop() + "/giphy.gif";
                                    link.innerHTML = '<img src="'+imageUrl+'" alt="'+link.textContent+'"/>';
                                }
                                match = /^https?:\/\/(www\.)?(youtu\.be\/|youtube\.com\/watch\?v=)([^&?]+).*$/mg.exec(link.textContent);
                                if (match) {
                                    var imageUrl = "https://img.youtube.com/vi/" + match[3] + "/mqdefault.jpg";
                                    link.innerHTML = link.textContent+'<br/><img src="'+imageUrl+'" alt="'+link.textContent+'"/>';
                                }
                                match = /^https?:\/\/(www\.)?twitter\.com.+\/([0-9]+)$/mg.exec(link.textContent);
                                if (match) {
                                    var tweetContainer = document.createElement('div');
                                    link.parentNode.appendChild(tweetContainer);
                                    tweetContainer.style.display = 'none';
                                    twttr.widgets.createTweet(match[2], tweetContainer, { theme: 'dark', conversation: 'hidden', cards: 'hidden' }).then(el => {
                                        tweetContainer.style.display = 'block';
                                        scrollReference = scrollDistance += el.scrollHeight;
                                    }).catch(e => console.log(e));
                                }
                            });
                        }

                        newNode.querySelectorAll('img').forEach(img => {
                            if (img.src.indexOf('jtvnw.net') === -1) { // don't do this for emoticons
                                img.style.display = 'none';
                                img.addEventListener('load', e => {
                                    img.style.display = 'inline';
                                    scrollReference = scrollDistance += Math.max(0, img.scrollHeight - newNode.dataset.height);
                                    newNode.dataset.height = newNode.scrollHeight;
                                });
                            }
                        });
                    }
                });
            }
        });
    });

    // Pass in the target node, as well as the observer options
    observer.observe(target, { childList: true });

    // Continually scroll up, in a way to make the comments readable
    var lastFrame = +new Date();
    function scrollUp(now) {
        if (GM_config.get("ReverseDirection")) {
            if (scrollDistance > 0 && GM_config.get("SmoothScroll")) {
                // estimate how far along we are in scrolling in the current scroll reference
                var currentStep = parseFloat(GM_config.get("SmoothScrollSpeed")) * 1000 / (now - lastFrame);
                scrollDistance -= scrollReference / currentStep;
                scrollDistance = Math.max(Math.floor(scrollDistance), 0);
                chatContentDiv.scrollTop = scrollDistance;
            } else {
                chatContentDiv.scrollTop = 0;
            }
        }
        lastFrame = now;
        window.requestAnimationFrame(scrollUp);
    }
    window.requestAnimationFrame(scrollUp);
    chatContentDiv.scrollTop = 0;

    // Disable Twitch autoscroll with a little trick for performance reasons
    if (GM_config.get("ReverseDirection")) {
        setTimeout(function() {
            chatContentDiv.scrollBy(0, -200);
            chatContentDiv.dispatchEvent(new WheelEvent('wheel', {deltaY: -200}));
            chatContentDiv.scrollBy(0, 200);
        }, 5000);
    }
}
GM_addStyle(`
@import url(https://fonts.googleapis.com/css?family=Open+Sans+Condensed:300,300italic,700);

body {
    background-color:black !important;
    font-family: 'Open Sans Condensed', sans-serif !important;
}

#root .chat-room__header, .chat-list__more-messages-placeholder, .pinned-cheer, .chat-room__notifications {
    display:none !important;
}

/* Thanks malc for the fixes to how the chat-interface looks*/
.chat-input {
    background: black;
}

.chat-input select,
.chat-input textarea,
.chat-input button,
.chat-input input[type=text],
.chat-input input[type=email],
.chat-input input[type=password],
.chat-input input[type=search],
.chat-input {
    font-size: 2.4rem !important;
}

.chat-list .tw-full-height.reverse {
    display:flex !important;
    flex-direction:column-reverse;
    padding-bottom:100vh !important;
}

.chat-room__container {
    top:0px !important;
    background-color:black !important;
}
.chat-list .tw-full-height {
    background-color:black !important;
    color:#eee;
    display: flex;
    flex-direction: column;
    justify-content:flex-start;
    padding-top:0 !important;
}
.chat-line__message.odd {
    background-color:#111 !important;
}
.chat-list .tw-full-height > .chat-line__message, .chat-line__status, .user-notice-line {
    padding:3px 1px 3px 6px !important;
    font-size:32px !important;
    line-height:35px !important;
    border-bottom:#444 solid 1px !important;
}

.chat-line__message .chat-card__link {
    background-color: #333 !important;
}
.chat-line__message .chat-card__link div {
    display: inline;
}
.chat-line__message .chat-card__link .chat-card__title span {
    font-size: 32px !important;
    line-height: 35px !important;
    color: white;
}
.chat-line__message .chat-card__link .chat-card__title + div span {
    font-size: 32px !important;
    line-height: 35px !important;
    color: #bbb !important;
}
div.mention-fragment {
    background-color: transparent !important;
    padding: 0;
}
.special-message {
    background-color: inherit !important;
}
.system-msg {
    background-color: inherit !important;
}

.mod-icon {
    display:none !important;
}
.chat-badge {
    display:none !important;
}
img {
    max-width:100%;
    max-height:50vh;
}
/* TODO: no whisper tested yet */
.chat-messages .whisper-line.whisper-incoming {
    background-color:#3b010e !important;
}
a {
    color:inherit !important;
}
.chat-author__display-name {
    color:green !important;
}
span[data-a-target='chat-message-text'], img.chat-image {
    color:white !important;
    font-weight:300 !important;
}

.deleted {
    opacity:0.2;
}
.mentioned {
    color: inherit;
    background-color: inherit;
}

img.chat-line__message--emote {
    margin:0;
    vertical-align:baseline;
}

/* Clean up subscription messages */
.tw-flex > .tw-c-text-alt-2 {
    display:none;
}
p.tw-c-text-link{
    display:inline;
}
.tw-mg-l-05 .tw-block {
    display:inline !important;
}
p.tw-c-text-link, p.tw-mg-l-05{
    font-size:32px;
    line-height:35px;
}
div.tw-mg-y-05{
    margin-bottom:0 !important;
    margin-top:0 !important;
}
div.tw-pd-y-05{
    padding:3px 1px 3px 6px !important;
}
div.tw-pd-r-2{
    padding-right:0 !important;
}

::-webkit-scrollbar {
    display: none;
}

#settings-wheel {
    position: absolute;
    right: 5px;
    top: 5px;
    color: rgba(255,255,255,0.3);
    cursor:pointer;
    z-index: 50;
}
#settings-wheel:hover {
    color: rgba(255,255,255,1);
}

.sticky-message {
    display:none !important;
}
.chat-messages {
    top:0px !important;
}
#hide {
    z-index: 99;
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: black;
    font-size: 32px;
    font-weight: bold;
    text-align: center;
    padding-top: 200px;
    display: none;
}
body .room-selector__header {
 display:none !important;
}
body .pinned-cheer-v2 {
 display:none !important;
}
.scrollable-area .simplebar-track {
    display:none !important;
}
.message-group .counter {
    font-weight: bold;
    float: right;
    font-size: 80%;
    transition: 1s;
    padding-right: 10px;
}
.message-group .counter.bump {
  transition: 0.1s;
  font-size: 150%;
}
`);
//inject custom stylessheet
var style = GM_getResourceText('style');
GM_addStyle(style);
var materialIcons = GM_getResourceText('material-icons');
GM_addStyle(materialIcons);
