// ==UserScript==
// @name         Next Room Info
// @version      1.5.1
// @description  Added the function of manually modifying the check in time
// @author       Daniel
// @match        https://app1.intellechart.net/Eye1/workflow*
// @match        https://app1.intellechart.net/Eye2/workflow*
// @grant        none
// @updateURL    https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// @downloadURL  https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// ==/UserScript==

(function() {
    'use strict';

    const INJECTION_KEYWORDS = [
        "INJECTION",
        "Iluvien",
        "Yutiq",
        "Blephex",
        "iLux",
        "Eylea",
        "Triesence",
        "Kenalog",
        "Izervay",
        "Avastin",
        "Ozurdex",
        "Vabysmo",
        "Syfovre",
        "TearLab",
        "Xipere"
    ];

    async function fetchApiData() {
        const url = 'https://apex.oracle.com/pls/apex/_satisfy/retina/getbyname/';
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.items || [];
    }

    function parseTitle(titleText) {
        const lines = titleText.split('\n').map(l => l.trim()).filter(Boolean);
        const info = {};
        for (let line of lines) {
            const parts = line.split(':').map(p => p.trim());
            if (parts.length > 1) {
                const key = parts[0];
                const val = parts.slice(1).join(':').trim();
                info[key] = val;
            }
        }

        let typeValue = info["Type"] || "";
        let category = "OTHER";
        const upperType = typeValue.toUpperCase();
        if (upperType.includes("NEW PATIENT")) {
            category = "NEW PATIENT";
        } else if (upperType.includes("ESTABLISHED PATIENT")) {
            category = "ESTABLISHED PATIENT";
        }

        for (const kw of INJECTION_KEYWORDS) {
            if (titleText.toUpperCase().includes(kw.toUpperCase())) {
                category = "INJECTION";
                break;
            }
        }

        const checkInTime = info["Check In"] || "";
        return {
            Doctor: info["Doctor"] || "",
            Type: category,
            CheckIn: checkInTime
        };
    }

    function timeToMinutes(t) {
        const match = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return null;
        let hour = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === "PM" && hour < 12) hour += 12;
        if (ampm === "AM" && hour === 12) hour = 0;
        return hour * 60 + minute;
    }

    function timeToMinutesFromISO(isoStr) {
        const d = new Date(isoStr);
        const hour = d.getHours();
        const minute = d.getMinutes();
        return hour*60 + minute;
    }

    function typePriority(type) {
        if (type === "INJECTION") return 1;
        if (type === "ESTABLISHED PATIENT") return 2;
        if (type === "NEW PATIENT") return 3;
        return 4; // OTHER
    }

    function within15Minutes(a, b) {
        return Math.abs(a.checkInMinutes - b.checkInMinutes) <= 15;
    }

    function allIEN(a,b) {
        const ta = typePriority(a.type);
        const tb = typePriority(b.type);
        return (ta<=3 && tb<=3);
    }

    function swapByTypePriority(array, i1, i2) {
        const a = array[i1], b = array[i2];
        if (allIEN(a,b) && within15Minutes(a,b)) {
            const pa = typePriority(a.type);
            const pb = typePriority(b.type);
            if (pb < pa) {
                [array[i1], array[i2]] = [array[i2], array[i1]];
            }
        }
    }

    function swapIfNeededUnderlineCase(arr) {
        if (arr.length < 3) return;
        swapByTypePriority(arr, 1, 2);
    }

    function swapIfNeededNoUnderlineCase(arr) {
        swapByTypePriority(arr,0,1);
        swapByTypePriority(arr,1,2);

        if (arr.length === 3) {
            const E1 = arr[0], E2 = arr[1], E3 = arr[2];
            const E2isOther = (typePriority(E2.type)===4);
            if (E2isOther && allIEN(E1,E3) && within15Minutes(E1,E3)) {
                const p1 = typePriority(E1.type);
                const p3 = typePriority(E3.type);
                if (p3 < p1) {
                    arr[0] = E3;
                    arr[2] = E1;
                }
            }
        }
        return arr;
    }

    function sortGroup(arr) {
        const underlineIndex = arr.findIndex(a => a.style.includes('text-decoration: underline;'));
        if (underlineIndex > -1) {
            const [underlineItem] = arr.splice(underlineIndex, 1);
            arr.unshift(underlineItem);
        }

        let startIndex = (underlineIndex > -1) ? 1 : 0;
        arr = arr.slice(0,startIndex).concat(
            arr.slice(startIndex).sort((a,b) => a.checkInMinutes - b.checkInMinutes)
        );
        arr = arr.slice(0,3);

        if (arr.length < 3) {
            if (arr.length === 3 && underlineIndex > -1) {
                swapIfNeededUnderlineCase(arr);
            }
            return arr;
        }

        if (underlineIndex > -1) {
            swapIfNeededUnderlineCase(arr);
        } else {
            swapIfNeededNoUnderlineCase(arr);
        }
        return arr;
    }

    const floatingWindow = document.createElement('div');
    floatingWindow.id = 'floatingWindow';
    floatingWindow.style.position = 'fixed';
    floatingWindow.style.bottom = '20px';
    floatingWindow.style.right = '20px';
    floatingWindow.style.width = '300px';
    floatingWindow.style.height = '250px';
    floatingWindow.style.backgroundColor = 'white';
    floatingWindow.style.border = '2px solid black';
    floatingWindow.style.padding = '10px';
    floatingWindow.style.overflowY = 'auto';
    floatingWindow.style.zIndex = '10000';
    floatingWindow.style.fontSize = '16px';
    floatingWindow.style.color = 'black';
    document.body.appendChild(floatingWindow);

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh';
    refreshBtn.style.display = 'block';
    refreshBtn.style.marginTop = '10px';
    floatingWindow.appendChild(refreshBtn);

    const modifyBtn = document.createElement('button');
    modifyBtn.textContent = 'Modify Check In Time';
    modifyBtn.style.display = 'block';
    modifyBtn.style.marginTop = '5px';
    floatingWindow.appendChild(modifyBtn);

    let apiItems = [];

    async function loadApiItems() {
        apiItems = await fetchApiData();
    }

    function parseLiTextForName(liText) {
        const match = liText.match(/^\S+\s+([^,]+),\s+(.*)$/);
        if (match) {
            let lastName = match[1].trim().replace(/,$/,'');
            let firstName = match[2].trim();
            return {firstName, lastName};
        }
        return {firstName:"", lastName:""};
    }

    function findCheckInFromApi(firstName, lastName) {
        firstName = firstName.toLowerCase();
        lastName = lastName.toLowerCase();
        for (let it of apiItems) {
            if (it.first_name.toLowerCase() === firstName && it.last_name.toLowerCase() === lastName) {
                return it.check_in_time;
            }
        }
        return null;
    }

    async function updateFloatingWindow() {
        const btn1 = refreshBtn;
        const btn2 = modifyBtn;

        floatingWindow.removeChild(btn1);
        floatingWindow.removeChild(btn2);
        floatingWindow.textContent = '';

        if (apiItems.length===0) {
            await loadApiItems();
        }

        const examPs = document.evaluate('//p[contains(text(),"Exam")]', document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        let extractedData = [];

        for (let i = 0; i < examPs.snapshotLength; i++) {
            const pElem = examPs.snapshotItem(i);
            const examText = pElem.textContent.trim();
            const liNode = document.evaluate('./following-sibling::li[1]', pElem, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (!liNode || !liNode.classList.contains("YellowListItem")) {
                continue;
            }

            const titleText = liNode.getAttribute('title') || "";
            const info = parseTitle(titleText);
            const styleVal = liNode.getAttribute('style') || "";
            const liText = liNode.textContent.trim();
            const {firstName, lastName} = parseLiTextForName(liText);

            let checkInTimeStr = info.CheckIn;
            let checkInMinutesVal = checkInTimeStr ? timeToMinutes(checkInTimeStr) : Number.MAX_SAFE_INTEGER;

            const apiCheckIn = findCheckInFromApi(firstName, lastName);
            if (apiCheckIn) {
                checkInTimeStr = apiCheckIn;
                checkInMinutesVal = timeToMinutesFromISO(apiCheckIn);
            }

            extractedData.push({
                examText: examText,
                doctor: info.Doctor,
                type: info.Type,
                checkInMinutes: checkInMinutesVal,
                style: styleVal,
                checkInStr: checkInTimeStr
            });
        }

        const groups = {};
        extractedData.forEach(item => {
            if (!groups[item.doctor]) {
                groups[item.doctor] = [];
            }
            groups[item.doctor].push(item);
        });

        for (let doctor in groups) {
            groups[doctor] = sortGroup(groups[doctor]);
        }

        // 不再显示CheckIn时间
        let resultText = "";
        for (let doctor in groups) {
            const examsText = groups[doctor].map(e => `${e.examText}`).join("，");
            resultText += `Dr. ${doctor}: ${examsText}\n`;
        }

        floatingWindow.textContent = resultText;
        floatingWindow.innerHTML = resultText.replace(/\n/g, "<br>");
        floatingWindow.appendChild(btn1);
        floatingWindow.appendChild(btn2);
    }

    refreshBtn.addEventListener('click', function() {
        updateFloatingWindow();
    });

    modifyBtn.addEventListener('click', function() {
        window.open('https://apex.oracle.com/pls/apex/r/_satisfy/no-show-patient/table', '_blank');
    });

    //setTimeout(() => {
    //    updateFloatingWindow();
    //}, 1000);

    updateFloatingWindow();

})();
