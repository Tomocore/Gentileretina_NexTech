// ==UserScript==
// @name         Next Room Info
// @version      2.0
// @description  Based on Waiting Time
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

  // --- 0. 创建悬浮窗口 & 按钮等 ---

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
  buttonContainer.style.alignItems = 'stretch';   // Stretch buttons to full width
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

  // Event listener for the Refresh button
  refreshBtn.addEventListener('click', function() {
    updateFloatingWindow();
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


  // --- 1. 核心逻辑：筛选/排序/输出 ---

  /**
   * 辅助方法：使用 XPath 查找符合条件的节点，返回 snapshot。
   * @param {string} xpath - 要执行的 XPath 表达式
   * @param {Node} context - 查找上下文，默认为 document
   * @returns {XPathResult} 返回 ORDERED_NODE_SNAPSHOT_TYPE 类型结果
   */
  function xpathSnapshot(xpath, context = document) {
    return document.evaluate(
      xpath,
      context,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
  }

  /**
   * 取到页面上所有形如 “Exam 1”、“Exam 2”... 的 <p> 文字（父元素= <ul>）
   * 这里仅作示例，你也可写死 ["Exam 1", "Exam 2", ...]。
   */
  function getAllExamNames() {
    const examPs = xpathSnapshot("//ul/p[contains(text(), 'Exam ')]");
    const examNames = new Set();
    for (let i = 0; i < examPs.snapshotLength; i++) {
      const pNode = examPs.snapshotItem(i);
      const txt = pNode.textContent.trim();
      examNames.add(txt);
    }
    return Array.from(examNames);
  }

  /**
   * 1.1 + 1.2：根据 <ul>/<li> 的 class、style 判断筛选 & 优先级
   * 返回 { canUse, topPriority }
   */
  function checkExamInfoFromUl(examName) {
    // 查找所有 <p>，文本=examName，父<ul>
    const pSnapshot = xpathSnapshot(`//ul/p[normalize-space(text())='${examName}']`);
    if (pSnapshot.snapshotLength === 0) {
      return { canUse: false, topPriority: false };
    }
    for (let i = 0; i < pSnapshot.snapshotLength; i++) {
      const pNode = pSnapshot.snapshotItem(i);
      const ulNode = pNode.parentNode;
      if (!ulNode || ulNode.tagName.toLowerCase() !== 'ul') {
        continue;
      }

      // 找到这个<ul> 下所有 <li>
      const liList = ulNode.querySelectorAll('li');
      if (liList.length === 0) {
        continue;
      }

      // 如果所有 <li> 都没 class="YellowListItem"，跳过
      let hasYellowClass = false;
      let hasUnderline = false;
      liList.forEach(li => {
        if (li.classList.contains("YellowListItem")) {
          hasYellowClass = true;
        }
        // 判断 style 是否等于 "text-decoration: underline;"
        if (li.getAttribute("style") === "text-decoration: underline;") {
          hasUnderline = true;
        }
      });

      if (!hasYellowClass) {
        // 找下一个
        continue;
      }

      // 找到满足条件的就返回
      return {
        canUse: true,
        topPriority: hasUnderline
      };
    }

    // 所有都不满足
    return { canUse: false, topPriority: false };
  }

  /**
   * 2. 从 <table>/<tr> 中获取该Exam的最大 waitingTime, Kind, Doctor
   *    - 注意：第 3 个 <td> 的内容的第 1 个单词 => Kind
   */
  function getExamSortingInfoFromTable(examName) {
    // 找到所有 <td> 内容=examName（父元素<tr>）
    const tdSnapshot = xpathSnapshot(`//td[normalize-space(text())='${examName}']`);
    if (tdSnapshot.snapshotLength === 0) {
      return null;
    }

    // 收集所有候选 waitingTime
    let candidateRows = []; // { row: <tr>, waitingTime: number }

    for (let i = 0; i < tdSnapshot.snapshotLength; i++) {
      const tdNode = tdSnapshot.snapshotItem(i);
      const trNode = tdNode.parentNode;
      if (!trNode || trNode.tagName.toLowerCase() !== 'tr') {
        continue;
      }
      // tr 里所有 td
      const allTds = trNode.querySelectorAll('td');
      if (allTds.length < 7) {
        continue;
      }
      // 第2个<td>里的<a> class检查 (patientLinks YellowListItem)
      const secondTd = allTds[1];
      const aElem = secondTd.querySelector('a');
      if (!aElem) {
        continue;
      }
      if (!aElem.classList.contains("patientLinks") || !aElem.classList.contains("YellowListItem")) {
        continue;
      }

      // 第7个<td>内容，比如 "20M", "140M"
      const seventhTd = allTds[6];
      const waitingStr = seventhTd.textContent.trim();
      const match = waitingStr.match(/^(\d+)\s*M$/);
      if (!match) {
        continue;
      }
      const wNum = parseInt(match[1], 10);
      candidateRows.push({ row: trNode, waitingTime: wNum });
    }

    if (candidateRows.length === 0) {
      return null;
    }
    // 按照 waitingTime 降序，取最大
    candidateRows.sort((a, b) => b.waitingTime - a.waitingTime);
    const { row: maxRow, waitingTime } = candidateRows[0];

    // 2.2.1
    const finalWaitingTime = waitingTime;

    // 2.2.2 第3个<td> 的内容的第1个单词 => Kind
    const allTds = maxRow.querySelectorAll('td');
    const thirdTdText = allTds[2].textContent.trim();
    let firstWord = thirdTdText.split(/\s+/)[0] || "OTHER";
    firstWord = firstWord.toUpperCase(); // 不区分大小写

    // 如果包含在注射相关列表中，则归为 "INJECTION"
    const injectionLikeWords = [
      'INJECTION', 'ILUVIEN', 'YUTIQ', 'BLEPHEX', 'ILUX', 'EYLEA', 'TRIESENCE',
      'KENALOG', 'IZERVAY', 'AVASTIN', 'OZURDEX', 'VABYSMO', 'SYFOVRE', 'TEARLAB', 'XIPERE'
    ];
    let kind = "OTHER";
    if (injectionLikeWords.includes(firstWord)) {
      kind = "INJECTION";
    } else if (firstWord === "NEW") {
      kind = "NEW";
    } else if (firstWord === "ESTABLISHED") {
      kind = "ESTABLISHED";
    }

    // 2.2.3 第6个<td>的内容 => Doctor
    const sixthTdText = allTds[5].textContent.trim();
    const doctor = sixthTdText;

    return {
      waitingTime: finalWaitingTime,
      kind: kind,
      doctor: doctor
    };
  }

  /**
   * 3.1~3.3 分组 & 排序
   */
  function getKindPriority(kind) {
    // "INJECTION" 最先，其次 "ESTABLISHED"，最后 "NEW"，其他更后
    switch (kind) {
      case "INJECTION":     return 1;
      case "ESTABLISHED":   return 2;
      case "NEW":           return 3;
      default:              return 4;
    }
  }

  /**
   * 主函数：获取数据 & 排序 & 输出到悬浮窗
   */
  function updateFloatingWindow() {
    // 先显示“Loading...”
    contentContainer.innerHTML = '...Loading...';

    // 1. 收集所有 Exam Name
    const examNames = getAllExamNames();

    // 2. 筛选 + 从表格获取数据
    const examDataList = []; // { name, waitingTime, kind, doctor, priorityFlag }
    examNames.forEach(name => {
      const { canUse, topPriority } = checkExamInfoFromUl(name);
      if (!canUse) {
        return;
      }
      const info = getExamSortingInfoFromTable(name);
      if (!info) {
        return;
      }
      examDataList.push({
        name,
        waitingTime: info.waitingTime,
        kind: info.kind,
        doctor: info.doctor,
        priorityFlag: topPriority
      });
    });

    // 3. 按 Doctor 分组
    const doctorMap = new Map();
    examDataList.forEach(item => {
      const doc = item.doctor;
      if (!doctorMap.has(doc)) {
        doctorMap.set(doc, []);
      }
      doctorMap.get(doc).push(item);
    });

    // 排序并生成输出
    const sortedResult = [];
    for (let [doctor, exams] of doctorMap.entries()) {
      // 先按 priorityFlag(true在前)，再按 waitingTime 降序
      exams.sort((a,b) => {
        if (a.priorityFlag && !b.priorityFlag) return -1;
        if (!a.priorityFlag && b.priorityFlag) return 1;
        return b.waitingTime - a.waitingTime;
      });

      // 对前三个Exam里，若有两两相邻都 <30 且差值<15 => 根据kind 交换顺序
      const len = Math.min(exams.length, 3);
      for (let i = 0; i < len - 1; i++) {
        for (let j = i+1; j < len; j++) {
          const e1 = exams[i], e2 = exams[j];
          if (e1.waitingTime < 30 && e2.waitingTime < 30) {
            const diff = Math.abs(e1.waitingTime - e2.waitingTime);
            if (diff < 15) {
              // 比较 kind priority
              const p1 = getKindPriority(e1.kind);
              const p2 = getKindPriority(e2.kind);
              // priority 小 => 靠前
              if (p2 < p1) {
                // 交换
                exams[i] = e2;
                exams[j] = e1;
              }
            }
          }
        }
      }

      // 加入最终结果
      sortedResult.push({ doctor, exams });
    }

    // 4. 在浮窗中输出（只显示 Exam； 如果 WaitingTime>30，则显示并标红）
    let htmlOutput = '';
    sortedResult.forEach(group => {
      const doc = group.doctor;
      // 组合
      const examStrs = group.exams.map(e => {
        // 只显示 Exam 名字，如果 waitingTime>30，就加上红色时间
        if (e.waitingTime > 30) {
          return `${e.name} (<span style="color:red;">${e.waitingTime}M</span>)`;
        } else {
          return e.name;
        }
      });
      // 每个doctor一行
      htmlOutput += `<div><b>Dr. ${doc}</b>: ${examStrs.join(' | ')}</div>`;
    });

    if (htmlOutput === '') {
      htmlOutput = 'No data found or no valid Exams.';
    }
    contentContainer.innerHTML = htmlOutput;
  }

  // --- 2. 加载脚本后先等 0.5 秒再执行，然后再等 0.5 秒再执行一次 ---

  // 第一次：等待 0.5 秒后执行
  setTimeout(() => {
    updateFloatingWindow();
    // 第二次：再等 0.5 秒后再执行一次
    setTimeout(() => {
      updateFloatingWindow();
    }, 500);
  }, 500);

})();
