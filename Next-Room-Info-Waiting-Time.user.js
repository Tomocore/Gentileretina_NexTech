// ==UserScript==
// @name         Next Room Info
// @version      2.0
// @description  Show next room info in a floating window, with injection keywords matched in case-insensitive manner
// @author       Daniel
// @match        https://app1.intellechart.net/Eye1/workflow.aspx*
// @match        https://app1.intellechart.net/Eye1/Workflow.aspx*
// @match        https://app1.intellechart.net/Eye2/workflow.aspx*
// @match        https://app1.intellechart.net/Eye2/Workflow.aspx*
// @grant        none
// @updateURL    https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// @downloadURL  https://github.com/Tomocore/Gentileretina_NexTech/raw/refs/heads/main/Next-Room-Info.user.js
// ==/UserScript==

(function() {
    'use strict';

    // Step 2.2.2: 如果获取到的单词属于以下列表（忽略大小写），则视为 "INJECTION"
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

    /**
     * 如果你需要在这里调用其他 API 获取数据，可替换下面这个示例 fetch 方法。
     * 当前只是演示：从某个 URL 获取 JSON，返回 data.items
     */
    async function fetchApiData() {
        const url = 'https://apex.oracle.com/pls/apex/_satisfy/retina/getbyname/';
        const response = await fetch(url);
        if (!response.ok) return [];
        const data = await response.json();
        return data.items || [];
    }

    /**
     * 解析 <li> 标签中的 title 内容，
     * 其中包含:
     *  Doctor: xxxxx
     *  Type: NEW PATIENT / ESTABLISHED PATIENT / 或其他
     *  Check In: 12:15 PM  (示例)
     * 等字段。
     * 并根据 INJECTION_KEYWORDS 做 “INJECTION” 的归类。
     */
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

        // 初步根据 'Type' 字段进行分类
        let typeValue = info["Type"] || "";
        let category = "OTHER";
        const upperType = typeValue.toUpperCase();
        if (upperType.includes("NEW PATIENT")) {
            category = "NEW PATIENT";
        } else if (upperType.includes("ESTABLISHED PATIENT")) {
            category = "ESTABLISHED PATIENT";
        }

        // 只要 title 里包含了任意 injection 关键词（不分大小写），我们就视为 INJECTION
        for (const kw of INJECTION_KEYWORDS) {
            if (titleText.toUpperCase().includes(kw.toUpperCase())) {
                category = "INJECTION";
                break;
            }
        }

        const checkInTime = info["Check In"] || "";
        return {
            Doctor: info["Doctor"] || "",
            Type: category,   // NEW PATIENT / ESTABLISHED PATIENT / INJECTION / OTHER
            CheckIn: checkInTime
        };
    }

    /**
     * 将标准的 12 小时制时间（12:15 PM等）转为分钟数，方便比较排序
     */
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

    /**
     * 如果 API 返回的是 ISO 日期时间串，可用这个方法做转换。
     * 例如： "2023-07-07T09:15:00.000Z" => 转为当天的 分钟数 (时*60 + 分)
     */
    function timeToMinutesFromISO(isoStr) {
        const d = new Date(isoStr);
        const hour = d.getHours();
        const minute = d.getMinutes();
        return hour * 60 + minute;
    }

    // 不同种类（kind/type）的优先级
    function typePriority(type) {
        if (type === "INJECTION") return 1;            // 注射最高
        if (type === "ESTABLISHED PATIENT") return 2;  // 老病人
        if (type === "NEW PATIENT") return 3;          // 新病人
        return 4;                                      // 其他
    }

    /**
     * 检测是否在 15 分钟以内
     */
    function within15Minutes(a, b) {
        return Math.abs(a.checkInMinutes - b.checkInMinutes) <= 15;
    }

    /**
     * 判断是否在 (INJECTION, ESTABLISHED, NEW) 这3类之内
     */
    function allIEN(a, b) {
        const ta = typePriority(a.type);
        const tb = typePriority(b.type);
        return (ta <= 3 && tb <= 3);
    }

    /**
     * 如果两项都在 I/E/N 中，且时间差 <= 15 分钟，则按照 typePriority 交换顺序
     */
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

    /**
     * 如果列表中有带下划线的优先项（style.includes('text-decoration: underline;')），
     * 那么放在最前面后，再对后两个进行可能的交换
     */
    function swapIfNeededUnderlineCase(arr) {
        if (arr.length < 3) return;
        // 只针对后两个做一下 swap 检查
        swapByTypePriority(arr, 1, 2);
    }

    /**
     * 如果没有下划线项，则对前3个做一次“相邻比对”，必要时交换顺序
     */
    function swapIfNeededNoUnderlineCase(arr) {
        // 先对 0,1；再对 1,2 做 swap
        swapByTypePriority(arr, 0, 1);
        swapByTypePriority(arr, 1, 2);

        // 特殊处理：如果中间的 (arr[1]) 恰好是 OTHER，而 arr[0] 和 arr[2] 都是 I/E/N，且时间差 <=15
        // 则在某些需求下，需要把 arr[2] 换到最前
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

    /**
     * 对同一位医生下的多条数据进行排序
     * 1. 如果有带下划线(style)的项，放最前
     * 2. 其余按照 checkInMinutes 从小到大（早到的在前）
     * 3. 对前三条再进行特殊的 swapIfNeeded 逻辑
     */
    function sortGroup(arr) {
        // 检查是否有下划线优先项
        const underlineIndex = arr.findIndex(a => a.style.includes('text-decoration: underline;'));
        if (underlineIndex > -1) {
            // 把它挪到最前
            const [underlineItem] = arr.splice(underlineIndex, 1);
            arr.unshift(underlineItem);
        }

        // 下划线那项固定后，对剩余进行按照 checkInMinutes 从小到大排序
        let startIndex = (underlineIndex > -1) ? 1 : 0;
        arr = arr.slice(0, startIndex).concat(
            arr.slice(startIndex).sort((a, b) => a.checkInMinutes - b.checkInMinutes)
        );

        // 只展示 / 只关心前3个（或先对前3个做特殊排序）
        // 如果你想展示所有，可以保留全部，然后只在前三个里做交换
        arr = arr.slice(0, 3);

        if (arr.length < 3) {
            // 数据不足 3 条，通常不用特殊交换
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

    // =========== 以下是浮动窗口相关的初始化 ===========

    // 创建一个浮动窗口
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

    // 标题
    const header = document.createElement('div');
    header.textContent = 'Next Room Info';
    header.style.textAlign = 'center';
    header.style.marginBottom = '10px';
    floatingWindow.appendChild(header);

    // 内容区
    const contentContainer = document.createElement('div');
    contentContainer.id = 'contentContainer';
    contentContainer.style.flexGrow = '1';
    contentContainer.style.overflowY = 'auto';
    floatingWindow.appendChild(contentContainer);

    // 按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'buttonContainer';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column'; // 纵向排列按钮
    buttonContainer.style.alignItems = 'stretch';   // 按钮宽度自适应
    buttonContainer.style.marginTop = '10px';
    floatingWindow.appendChild(buttonContainer);

    // ① Refresh 按钮
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Reload Script';
    refreshBtn.style.marginBottom = '5px'; // 按钮间距
    refreshBtn.style.padding = '8px';
    refreshBtn.style.border = 'none';
    refreshBtn.style.backgroundColor = '#4CAF50';
    refreshBtn.style.color = 'white';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.style.borderRadius = '4px';
    refreshBtn.style.width = '100%';
    buttonContainer.appendChild(refreshBtn);

    // ② Modify CheckIn 按钮
    const modifyBtn = document.createElement('button');
    modifyBtn.textContent = 'Modify Check In Time';
    modifyBtn.style.marginBottom = '5px';
    modifyBtn.style.padding = '8px';
    modifyBtn.style.border = 'none';
    modifyBtn.style.backgroundColor = '#008CBA';
    modifyBtn.style.color = 'white';
    modifyBtn.style.cursor = 'pointer';
    modifyBtn.style.borderRadius = '4px';
    modifyBtn.style.width = '100%';
    buttonContainer.appendChild(modifyBtn);

    // ③ Minimize 按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = 'Minimize';
    minimizeBtn.style.padding = '8px';
    minimizeBtn.style.border = 'none';
    minimizeBtn.style.backgroundColor = '#f44336';
    minimizeBtn.style.color = 'white';
    minimizeBtn.style.cursor = 'pointer';
    minimizeBtn.style.borderRadius = '4px';
    minimizeBtn.style.width = '100%';
    buttonContainer.appendChild(minimizeBtn);

    // “Show Next Patient” 按钮（初始隐藏，用于最小化后再显示）
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
    showBtn.style.display = 'none';
    document.body.appendChild(showBtn);

    // 存放从 API 获取的患者 check_in_time 数据
    let apiItems = [];

    // 异步加载 API 数据
    async function loadApiItems() {
        apiItems = await fetchApiData();
    }

    /**
     * 尝试从 li 的文本中拆分出 firstName, lastName
     * 例如: "Exam 1  Gentile, John" => lastName="Gentile", firstName="John"
     * 这里示例正则可能需根据你的页面实际情况调整
     */
    function parseLiTextForName(liText) {
        const match = liText.match(/^\S+\s+([^,]+),\s+(.*)$/);
        if (match) {
            let lastName = match[1].trim().replace(/,$/, '');
            let firstName = match[2].trim();
            return { firstName, lastName };
        }
        return { firstName: "", lastName: "" };
    }

    /**
     * 在 apiItems 中查找对应的 checkInTime
     */
    function findCheckInFromApi(firstName, lastName) {
        firstName = firstName.toLowerCase();
        lastName = lastName.toLowerCase();
        for (let it of apiItems) {
            if (
                it.first_name.toLowerCase() === firstName &&
                it.last_name.toLowerCase() === lastName
            ) {
                return it.check_in_time; // 例如 "2023-12-26T09:15:00"
            }
        }
        return null;
    }

    /**
     * 核心：搜集页面 <p> 包含“Exam”的元素，找到关联的 <li>，解析 doctor/type/checkinMinutes 等信息后分组与排序。
     */
    async function updateFloatingWindow() {
        // 先清空
        contentContainer.innerHTML = '';

        // 如果还没加载 API 数据，就加载一次
        if (apiItems.length === 0) {
            await loadApiItems();
        }

        // XPath 找到所有 <p> 文本包含"Exam" 的节点
        const examPs = document.evaluate(
            '//p[contains(text(),"Exam")]',
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        let extractedData = [];

        for (let i = 0; i < examPs.snapshotLength; i++) {
            const pElem = examPs.snapshotItem(i);
            const examText = pElem.textContent.trim();

            // 假设对应的 <li> 紧跟在后面，或用其他 XPath： "./following-sibling::li[1]" ...
            const liNode = document.evaluate(
                './following-sibling::li[1]',
                pElem,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            // 1.1 如果不存在 <li> 或其 class 不满足 YellowListItem，则跳过
            if (!liNode || !liNode.classList.contains("YellowListItem")) {
                continue;
            }

            // 拿到 title 进一步解析
            const titleText = liNode.getAttribute('title') || "";
            const info = parseTitle(titleText);

            // <li> 的 style 是否带下划线
            const styleVal = liNode.getAttribute('style') || "";

            // <li> 的文本，用于拆分患者姓名
            const liText = liNode.textContent.trim();
            const { firstName, lastName } = parseLiTextForName(liText);

            // 初步拿到 CheckInTime
            let checkInTimeStr = info.CheckIn;
            let checkInMinutesVal = checkInTimeStr
                ? timeToMinutes(checkInTimeStr)
                : Number.MAX_SAFE_INTEGER; // 如果没有，则给个极大值

            // 如果在 API 中查到更准确的 CheckInTime，则用 API 的
            const apiCheckIn = findCheckInFromApi(firstName, lastName);
            if (apiCheckIn) {
                checkInTimeStr = apiCheckIn;
                checkInMinutesVal = timeToMinutesFromISO(apiCheckIn);
            }

            extractedData.push({
                examText: examText,        // 例: "Exam 1"
                doctor: info.Doctor,       // parseTitle 解析到的 Doctor
                type: info.Type,           // "INJECTION"/"ESTABLISHED PATIENT"/"NEW PATIENT"/"OTHER"
                checkInMinutes: checkInMinutesVal,
                style: styleVal,
                checkInStr: checkInTimeStr
            });
        }

        // 分组：按 doctor
        const groups = {};
        extractedData.forEach(item => {
            if (!groups[item.doctor]) {
                groups[item.doctor] = [];
            }
            groups[item.doctor].push(item);
        });

        // 针对每个医生组做排序
        for (let doctor in groups) {
            groups[doctor] = sortGroup(groups[doctor]);
        }

        // 组装文本，展示在悬浮窗中
        let resultText = "";
        for (let doctor in groups) {
            const examsText = groups[doctor].map(e => `${e.examText}`).join("，");
            resultText += `Dr. ${doctor}: ${examsText}\n`;
        }

        // 显示到浮动窗口
        contentContainer.innerHTML = resultText.replace(/\n/g, "<br>");
    }

    // =========== 按钮事件 ===========

    // 刷新脚本逻辑
    refreshBtn.addEventListener('click', function() {
        updateFloatingWindow();
    });

    // 修改 Check In Time 按钮，打开一个外部链接
    modifyBtn.addEventListener('click', function() {
        window.open(
            'https://apex.oracle.com/pls/apex/r/_satisfy/no-show-patient/table',
            '_blank'
        );
    });

    // 最小化事件
    minimizeBtn.addEventListener('click', function() {
        floatingWindow.style.display = 'none';
        showBtn.style.display = 'block';
    });

    // 恢复按钮事件
    showBtn.addEventListener('click', function() {
        floatingWindow.style.display = 'flex';
        showBtn.style.display = 'none';
    });

    // 如果想让“最小化状态”在刷新后依旧保留，可用 localStorage。示例已注释，可自行打开：
    /*
    // if (localStorage.getItem('floatingWindowMinimized') === 'true') {
    //     floatingWindow.style.display = 'none';
    //     showBtn.style.display = 'block';
    // }

    // minimizeBtn.addEventListener('click', function() {
    //     floatingWindow.style.display = 'none';
    //     showBtn.style.display = 'block';
    //     localStorage.setItem('floatingWindowMinimized', 'true');
    // });
    // showBtn.addEventListener('click', function() {
    //     floatingWindow.style.display = 'flex';
    //     showBtn.style.display = 'none';
    //     localStorage.setItem('floatingWindowMinimized', 'false');
    // });
    */

    // 首次运行时自动执行
    updateFloatingWindow();
})();
