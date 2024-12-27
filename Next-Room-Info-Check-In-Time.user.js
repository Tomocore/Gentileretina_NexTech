// ==UserScript==
// @name         Next Room Info Check In Time
// @version      1.6.2
// @description  Added the function of manually modifying the check in time, a minimize button, and aligned buttons in a column
// @author       Daniel
// @match        https://app1.intellechart.net/Eye1/workflow.aspx*
// @match        https://app1.intellechart.net/Eye1/Workflow.aspx*
// @match        https://app1.intellechart.net/Eye2/workflow.aspx*
// @match        https://app1.intellechart.net/Eye2/Workflow.aspx*
// @grant        none
// @updateURL    https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info-Check-In-Time.user.js
// @downloadURL  https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info-Check-In-Time.user.js
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
        return hour * 60 + minute;
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

    function allIEN(a, b) {
        const ta = typePriority(a.type);
        const tb = typePriority(b.type);
        return (ta <= 3 && tb <= 3);
    }

    function swapByTypePriority(array, i1, i2) {
        const a = array[i1], b = array[i2];
        if (allIEN(a, b) && within15Minutes(a, b)) {
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
        swapByTypePriority(arr, 0, 1);
        swapByTypePriority(arr, 1, 2);

        if (arr.length === 3) {
            const E1 = arr[0], E2 = arr[1], E3 = arr[2];
            const E2isOther = (typePriority(E2.type) === 4);
            if (E2isOther && allIEN(E1, E3) && within15Minutes(E1, E3)) {
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
        arr = arr.slice(0, startIndex).concat(
            arr.slice(startIndex).sort((a, b) => a.checkInMinutes - b.checkInMinutes)
        );
        arr = arr.slice(0, 3);

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

    // ### Floating Window Creation ###

    // Create the floating window
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
    floatingWindow.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    floatingWindow.style.borderRadius = '8px';
    floatingWindow.style.display = 'flex';
    floatingWindow.style.flexDirection = 'column';
    floatingWindow.style.justifyContent = 'space-between';
    document.body.appendChild(floatingWindow);

    // Create the Header
    const header = document.createElement('div');
    header.textContent = 'Next Room Info';
    header.style.textAlign = 'center';
    header.style.marginBottom = '10px';
    floatingWindow.appendChild(header);

    // Create the content container
    const contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.style.flexGrow = '1';
    contentContainer.style.overflowY = 'auto';
    floatingWindow.appendChild(contentContainer);

    // Create the button container
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'buttonContainer';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column'; // Vertical alignment
    buttonContainer.style.alignItems = 'stretch'; // Stretch buttons to full width
    buttonContainer.style.marginTop = '10px';
    floatingWindow.appendChild(buttonContainer);

    // Create the Refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Reload Script';
    refreshBtn.style.marginBottom = '5px'; // Space between buttons
    refreshBtn.style.padding = '8px';
    refreshBtn.style.border = 'none';
    refreshBtn.style.backgroundColor = '#4CAF50';
    refreshBtn.style.color = 'white';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.style.borderRadius = '4px';
    refreshBtn.style.width = '100%'; // Full width for vertical layout
    buttonContainer.appendChild(refreshBtn);

    // Create the Modify Check In Time button
    const modifyBtn = document.createElement('button');
    modifyBtn.textContent = 'Modify Check In Time';
    modifyBtn.style.marginBottom = '5px'; // Space between buttons
    modifyBtn.style.padding = '8px';
    modifyBtn.style.border = 'none';
    modifyBtn.style.backgroundColor = '#008CBA';
    modifyBtn.style.color = 'white';
    modifyBtn.style.cursor = 'pointer';
    modifyBtn.style.borderRadius = '4px';
    modifyBtn.style.width = '100%'; // Full width for vertical layout
    buttonContainer.appendChild(modifyBtn);

    // Create the Minimize button
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = 'Minimize';
    minimizeBtn.style.padding = '8px';
    minimizeBtn.style.border = 'none';
    minimizeBtn.style.backgroundColor = '#f44336';
    minimizeBtn.style.color = 'white';
    minimizeBtn.style.cursor = 'pointer';
    minimizeBtn.style.borderRadius = '4px';
    minimizeBtn.style.width = '100%'; // Full width for vertical layout
    buttonContainer.appendChild(minimizeBtn);

    // Create the "Show Next Patient" button (initially hidden)
    const showBtn = document.createElement('button');
    showBtn.textContent = 'Show Next Patient';
    showBtn.style.position = 'fixed';
    showBtn.style.bottom = '20px';
    showBtn.style.right = '20px';
    showBtn.style.width = '150px';
    showBtn.style.padding = '10px';
    showBtn.style.border = 'none';
    showBtn.style.backgroundColor = '#555555';
    showBtn.style.color = 'white';
    showBtn.style.cursor = 'pointer';
    showBtn.style.borderRadius = '4px';
    showBtn.style.zIndex = '10000';
    showBtn.style.display = 'none'; // Hidden by default
    document.body.appendChild(showBtn);

    let apiItems = [];

    async function loadApiItems() {
        apiItems = await fetchApiData();
    }

    function parseLiTextForName(liText) {
        const match = liText.match(/^\S+\s+([^,]+),\s+(.*)$/);
        if (match) {
            let lastName = match[1].trim().replace(/,$/, '');
            let firstName = match[2].trim();
            return { firstName, lastName };
        }
        return { firstName: "", lastName: "" };
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
        // Clear existing content
        contentContainer.innerHTML = '';

        if (apiItems.length === 0) {
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
            const { firstName, lastName } = parseLiTextForName(liText);

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

        let resultText = "";
        for (let doctor in groups) {
            const examsText = groups[doctor].map(e => `${e.examText}`).join("，");
            resultText += `Dr. ${doctor}: ${examsText}\n`;
        }

        // Update the content container
        contentContainer.textContent = resultText;
        contentContainer.innerHTML = resultText.replace(/\n/g, "<br>");
    }

    // Event listener for the Refresh button
    refreshBtn.addEventListener('click', function() {
        updateFloatingWindow();
    });

    // Event listener for the Modify Check In Time button
    modifyBtn.addEventListener('click', function() {
        window.open('https://apex.oracle.com/pls/apex/r/_satisfy/no-show-patient/table', '_blank');
    });

    // Event listener for the Minimize button
    minimizeBtn.addEventListener('click', function() {
        floatingWindow.style.display = 'none';
        showBtn.style.display = 'block';
    });

    // Event listener for the Show Next Patient button
    showBtn.addEventListener('click', function() {
        floatingWindow.style.display = 'flex';
        showBtn.style.display = 'none';
    });

    updateFloatingWindow();

})();
