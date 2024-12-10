// ==UserScript==
// @name         Next Room Info
// @version      1.4
// @description  Add rules for sorting
// @author       Daniel
// @match        https://app1.intellechart.net/Eye2/workflow*
// @grant        none
// @updateURL    https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// @downloadURL  https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// ==/UserScript==

(function() {
    'use strict';

    const INJECTION_KEYWORDS = [
        "INJECTION",
        "ILUVIEN",
        "YUTIQ",
        "BLEPHEX",
        "ILUX",
        "EYLEA",
        "TRIESENCE",
        "KENALOG",
        "IZERVAY",
        "AVASTIN",
        "OZURDEX",
        "VABYSMO",
        "SYFOVRE",
        "TEARLAB",
        "XIPERE"
    ];

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
        // 无underline
        swapByTypePriority(arr,0,1);
        swapByTypePriority(arr,1,2);

        // 特殊情况：E2为Other, E1,E3为I/E/N且≤15分钟
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

    // 创建悬浮窗口及刷新按钮
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

    // 由于floatingWindow本身有overflowY=auto，为了在底部显示按钮，这里简单在上方插入内容
    floatingWindow.appendChild(refreshBtn);

    // 将提取和更新逻辑放入函数方便多次调用
    function updateFloatingWindow() {
        // 每次刷新前先清空除按钮外的内容
        // 保存按钮在底部，需要先移除按钮再重新添加
        const btn = floatingWindow.removeChild(refreshBtn);
        floatingWindow.textContent = '';

        // 开始提取数据
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
            const checkInM = timeToMinutes(info.CheckIn);
            const styleVal = liNode.getAttribute('style') || "";

            extractedData.push({
                examText: examText,
                doctor: info.Doctor,
                type: info.Type,
                checkInMinutes: checkInM,
                style: styleVal
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

        // 输出结果
        let resultText = "";
        for (let doctor in groups) {
            const exams = groups[doctor].map(e => e.examText).join("，");
            resultText += `Dr. ${doctor}: ${exams}\n`;
        }

        floatingWindow.textContent = resultText;
        // 重新添加按钮
        floatingWindow.appendChild(btn);
    }

    // 刷新按钮点击事件
    refreshBtn.addEventListener('click', function() {
        updateFloatingWindow();
    });

    // 页面加载后5秒内，每0.5秒刷新一次
    let startTime = Date.now();
    let intervalId = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > 5) {
            clearInterval(intervalId);
        } else {
            updateFloatingWindow();
        }
    }, 500);

    // 初次加载时可以先行更新一次
    updateFloatingWindow();

})();
