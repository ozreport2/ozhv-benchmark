
const testQueue = [
    "Dataset_0100", "Dataset_0500", "Dataset_1000",
    "PDFDoc_2", "PDFDoc_3", "PDFDoc_6", // "PDFDoc_20",
    "OZD_01", "OZD_10", "OZD_20",
    "MultiDoc_02", "MultiDoc_10", "MultiDoc_20"
];
const stepOrder = ["init", "bind", "export"];
const optionNames = ["svurl", "rvurl", "exportfrom", "mstyle"];
const resultColumnNames = ["Test Case", "Step", "Avg Time (ms)"];
let currentTestIndex = 0;
let currentIteration = 0;
let tempResults = {};
let startTime = 0;
const lastExecInfo = {
    date: "",
    userAgent: "",
    options: [],
    data: [],
};

const MAX_ITERATIONS = 3;
const iframe = document.getElementById('testTarget');
const btnStart = document.getElementById('startBtn');
const elemHistoryLog = document.getElementById('historyLog');
const elemStatusMsg = document.getElementById('statusMsg');

const optionValues = (() => {
    const v = {};
    optionNames.forEach(optName => {
        /** @type {HTMLSelectElement|null} */
        const elemSelect = document.getElementById(optName + "_select");
        if (!elemSelect) {
            return;
        }
        /** @type {HTMLInputElement|null} */
        const elemCustom = document.getElementById(optName + "_custom");
        const onSelectChange = () => {
            const selectedOption = elemSelect.selectedOptions[0];
            if (selectedOption.value == "custom") {
                if (elemCustom) {
                    elemCustom.disabled = false;
                }
            } else {
                if (elemCustom) {
                    elemCustom.disabled = true;
                    elemCustom.value = selectedOption.value;
                }
                v[optName] = selectedOption.value;
            }
        };
        onSelectChange();
        elemSelect.addEventListener("change", ev => onSelectChange());
        if (elemCustom) {
            elemCustom.addEventListener("blur", ev => {
                const selectedOption = elemSelect.selectedOptions[0];
                if (selectedOption.value == "custom") {
                    v[optName] = elemCustom.value;
                } else {
                    v[optName] = selectedOption.value;
                }
            });
        }
    });
    return v;
})();

btnStart.addEventListener('click', () => {
    if (testQueue.length === 0) return alert("No test cases");
    
    currentTestIndex = 0;
    elemHistoryLog.innerHTML = '';
    btnStart.disabled = true;
    document.querySelectorAll(".option-item select").forEach(select => { select.disabled = true; });

    lastExecInfo.date = (new Date()).toString();
    lastExecInfo.userAgent = navigator.userAgent;
    lastExecInfo.options = optionNames.map(optName => `${optName} = ${optionValues[optName]}`);
    lastExecInfo.data.length = 0;

    addLog("Start", true);
    addLog(`[Date]\n\n${lastExecInfo.date}`);
    addLog(`[User Agent]\n\n${lastExecInfo.userAgent.split(") ").join(")\n")}`);
    addLog(`[Options]\n\n${lastExecInfo.options.join("\n\n")}`);
    
    startNextTest();
});

function startNextTest() {
    if (currentTestIndex >= testQueue.length) {
        onFinish();
        return;
    }

    currentIteration = 0;
    tempResults = { init: [], bind: [], export: [] };
    
    const testName = testQueue[currentTestIndex];
    document.getElementById('currentTestDisplay').innerText = testName;
    document.getElementById('progressText').innerText = `${currentTestIndex + 1} / ${testQueue.length} Test Cases`;
    
    addLog(`Test Case: ${testName}`, true);
    runIteration();
}

function onFinish() {
    iframe.src = "";
    elemStatusMsg.innerText = "전체 테스트 완료";
    addLog(`Completed`, true);
    btnStart.disabled = false;
    document.querySelectorAll(".option-item select").forEach(select => { select.disabled = false; });

    const enc = new TextEncoder();
    const dataJson = JSON.stringify(lastExecInfo, null, 4);
    if (dataJson) {
        addDownloadLinkLog("benchmark_result.json", new Blob([enc.encode(dataJson)], { type: "text/json;charset=utf-8" }));
    }
    const dataCsv = (() => {
        const lines = [];
        lines.push(["Date", lastExecInfo.date]);
        lines.push(["User Agent", lastExecInfo.userAgent]);
        lines.push(["Options", lastExecInfo.options.join("; ")]);
        lines.push([""]);
        lines.push(resultColumnNames);
        lastExecInfo.data.forEach(item => {
            lines.push(resultColumnNames.map(colName => item[colName] || ""));
        });
        return lines.map(line => line.join(",")).join("\r\n");
    })();
    if (dataCsv) {
        addDownloadLinkLog("benchmark_result.csv", new Blob([enc.encode(dataCsv)], { type: "text/csv;charset=utf-8" }));
    }
}

function runIteration() {
    currentIteration++;
    const testName = testQueue[currentTestIndex];
    if (currentIteration > MAX_ITERATIONS) {
        updateSummary(testName);
        currentTestIndex++;
        setTimeout(startNextTest, 1000); // 1초 뒤 다음 URL로
        return;
    }

    elemStatusMsg.innerText = `${currentIteration}회차 측정 중...`;
    startTime = performance.now();
    const optionParams = (() => {
        const pairs = optionNames.map(optName => {
            const optValue = optionValues[optName];
            if (!optName || !optValue) {
                return;
            }
            return `${optName}=${optValue}`;
        }).filter(s => s.length > 1);
        if (pairs.length <= 0) {
            return "";
        }
        return "&" + pairs.join("&");
    })();
    iframe.src = `./rvh/?target=${testName}&t=${Date.now()}` + optionParams;
}

/**
 * @param {string} base64
 * @param {string} contentType
 */
function makeBlobFromBase64(base64, contentType) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
}

window.addEventListener("message", event => {
    if (event.source == window) {
        return;
    }

    const { type, step, ref } = event.data;
    if (type != "stopwatch") {
        return;
    }

    const testName = testQueue[currentTestIndex];
    setTimeout(() => updateSummary(testName));
    if (step == "finish") {
        setTimeout(runIteration, 500); // 다음 회차 진행
        return;
    }

    const duration = performance.now() - startTime;
    startTime = performance.now();
    if (!tempResults[step]) {
        tempResults[step] = [];
    }
    tempResults[step].push({
        startTime,
        duration,
    });

    if (ref) {
        switch (step) {
            case "export":
                if (currentIteration >= MAX_ITERATIONS) {
                    try {
                        const obj = JSON.parse(ref);
                        Object.keys(obj).forEach(k => {
                            const blob = makeBlobFromBase64(obj[k], "application/pdf");
                            const fileName = testName + "_" + (k.endsWith(".pdf") ? k : k + ".pdf");
                            addDownloadLinkLog(fileName, blob);
                        });
                    } catch (e) {
                        addErrorLog(e);
                    }
                }
                break;
            case "error":
                addErrorLog(ref);
                break;
        }
    }
    
});

function appendHistoryLog(elemLi) {
    elemHistoryLog.append(elemLi);
    const parent = elemHistoryLog.parentElement;
    if (parent) {
        parent.scrollTop = parent.scrollHeight;
    }
}

function addLog(msg, active = false) {
    const li = document.createElement('li');
    li.innerText = msg;
    if (active) {
        li.classList.add('active');
    }
    appendHistoryLog(li);
}

function addErrorLog(e) {
    console.error("[Error Log]", e);
    const li = document.createElement('li');
    li.innerText = e;
    li.classList.add('error');
    appendHistoryLog(li);
}

function addDownloadLinkLog(fileName, blob) {
    addLinkLog(fileName, ev => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.download = fileName;
        a.href = url;
        a.target = "_blank";
        a.style.position = "absolute";
        a.style.opacity = "0";

        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 1000);
    });
}

function addLinkLog(caption, callback) {
    if (typeof callback != "function") {
        return;
    }

    const li = document.createElement('li');
    const anchor = document.createElement("a");
    anchor.innerText = caption;
    anchor.addEventListener("click", ev => {
        anchor.disabled = true;
        callback(ev);
        anchor.disabled = false;
    });
    li.append(anchor);
    appendHistoryLog(li);
}

function updateSummary(testName) {
    const keys = Object.keys(tempResults);
    keys.sort((a, b) => {
        const orderA = stepOrder.indexOf(a);
        const orderB = stepOrder.indexOf(b);
        if (orderB < 0) {
            if (orderA < 0) {
                return 0;
            }
            return -1;
        } else if (orderA < 0) {
            return 1;
        }
        return orderA - orderB;
    });
    keys.forEach(k => {
        const stepResults = tempResults[k].map(info => info.duration);
        const displayAvg = document.getElementById(`avg_${k}`);
        const displayMax = document.getElementById(`max_${k}`);
        const displayLast = document.getElementById(`last_${k}`);
        if (stepResults.length <= 0) {
            if (displayLast) {
                displayLast.innerText = "-";
            }
            if (displayAvg) {
                displayAvg.innerText = "-";
            }
            if (displayMax) {
                displayMax.innerText = "-";
            }
            return;
        }
        
        if (displayAvg) {
            const avgTime = (stepResults.reduce((a,b)=>a+b,0) / stepResults.length).toFixed(1);
            displayAvg.innerText = avgTime;
            if (currentIteration > MAX_ITERATIONS) {
                addLog(`AVG ${k}: ${avgTime}ms`);
                const resultItem = {};
                resultItem[resultColumnNames[0]] = testName;
                resultItem[resultColumnNames[1]] = k;
                resultItem[resultColumnNames[2]] = avgTime;
                lastExecInfo.data.push(resultItem);
            }
        }
        if (displayMax) {
            const maxTime = Math.max(...stepResults).toFixed(1);
            displayMax.innerText = maxTime;
        }
        if (displayLast) {
            const lastTime = stepResults[stepResults.length - 1].toFixed(1);
            displayLast.innerText = lastTime;
            console.log({ try: stepResults.length, step: k, time: parseFloat(lastTime) });
        }
    });
}