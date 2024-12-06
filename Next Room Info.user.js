// ==UserScript==
// @name         Next Room Info
// @namespace    https://github.com/Tomocore/Gentileretina_NexTech/edit/main/Next%20Room%20Info.user.js
// @version      1.2
// @description  Add the feature that the program will first check if a patient is set to be the next
// @author       Daniel
// @match        https://app1.intellechart.net/Eye2/workflow*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/Tomocore/Gentileretina_NexTech/edit/main/Next%20Room%20Info.user.js
// @downloadURL  https://raw.githubusercontent.com/Tomocore/Gentileretina_NexTech/edit/main/Next%20Room%20Info.user.js
// ==/UserScript==

(function() {
    'use strict';

    const createFloatingWindow = () => {
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
/*
        const refreshButton = document.createElement('button');
        refreshButton.innerText = 'Refresh';
        refreshButton.style.marginTop = '10px';
        refreshButton.style.display = 'block';
        refreshButton.onclick = processDoctorData;
        floatingWindow.appendChild(refreshButton);

        const additionalText = document.createElement('p');
        additionalText.innerText = 'If a patient was set "Not Show/Reschedule" but comes, manually set the next patient after they are moved to the exam room';
        additionalText.style.marginTop = '10px';
        floatingWindow.appendChild(additionalText);
*/
        document.body.appendChild(floatingWindow);
    };

    const updateFloatingWindow = (doctorData) => {
        const floatingWindow = document.getElementById('floatingWindow');
        if (!floatingWindow) return;

        let content = '<strong>Next Exam Room:</strong><br><br>';
        for (const doctor of ["RG", "DP", "LS", "VR"]) {
            const exams = doctorData[doctor] || [];
            if (exams.length > 0) {
                const rooms = exams.map(item => item.exam.replace('Exam', 'Room')).join('，');
                content += `Dr. ${doctor}: ${rooms}<br>`;
            }
        }

        floatingWindow.innerHTML = content;

        const refreshButton = document.createElement('button');
        refreshButton.innerText = 'Refresh';
        refreshButton.style.marginTop = '10px';
        refreshButton.style.display = 'block';
        refreshButton.onclick = processDoctorData;
        floatingWindow.appendChild(refreshButton);
        const additionalText = document.createElement('p');

        additionalText.innerText = 'If the Check In time of a patient is incorrect, manually set the next patient until he/she leaves the exam room';
        additionalText.style.marginTop = '10px';
        floatingWindow.appendChild(additionalText);

    };

    const processDoctorData = () => {
        const exams = ["Exam 1", "Exam 2", "Exam 3", "Exam 4", "Exam 5"];

        const doctorData = {
            RG: [],
            DP: [],
            LS: [],
            VR: []
        };

        exams.forEach((exam) => {
            const result = document.evaluate(
                `//p[contains(@id, 'boxtitle') and text()='${exam}']
                  /../li[@class='YellowListItem']/@title`,
                document,
                null,
                XPathResult.STRING_TYPE,
                null
            ).stringValue;

            if (result) {
                const checkInContent = result.match(/Check In: (.*?)(\n|$)/)?.[1] || "Not found";
                const doctorContent = result.match(/Doctor: (.*?)(\n|$)/)?.[1] || "Not found";
                const liElement = document.evaluate(
                    `//p[contains(@id, 'boxtitle') and text()='${exam}']/../li[@class='YellowListItem']`,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;

                const isUnderlined = liElement && liElement.style.textDecoration === 'underline';

                if (doctorData[doctorContent]) {
                    doctorData[doctorContent].push({
                        exam: exam,
                        checkInTime: checkInContent,
                        isUnderlined: isUnderlined
                    });
                } else {
                    doctorData[doctorContent] = [{
                        exam: exam,
                        checkInTime: checkInContent,
                        isUnderlined: isUnderlined
                    }];
                }
            }
        });

        for (const doctor in doctorData) {
            doctorData[doctor].sort((a, b) => {
                if (a.isUnderlined && !b.isUnderlined) {
                    return -1;
                } else if (!a.isUnderlined && b.isUnderlined) {
                    return 1;
                } else {
                    const timeA = new Date(`1970/01/01 ${a.checkInTime}`);
                    const timeB = new Date(`1970/01/01 ${b.checkInTime}`);
                    return timeA - timeB;
                }
            });
        }

        updateFloatingWindow(doctorData);

        for (const doctor of ["RG", "DP", "LS", "VR"]) {
            const exams = doctorData[doctor] || [];
            if (exams.length > 0) {
                const rooms = exams.map(item => item.exam.replace('Exam', 'Room')).join('，');
                console.log(`Dr. ${doctor}： ${rooms}`);
            }
        }
    };

    createFloatingWindow();

    window.addEventListener('load', () => {
        setTimeout(() => {
            processDoctorData();

            let refreshCount = 0;
            const refreshInterval = setInterval(() => {
                processDoctorData();
                refreshCount++;
                if (refreshCount >= 10) {
                    clearInterval(refreshInterval);
                }
            }, 500);
        }, 0);
    });
})();

