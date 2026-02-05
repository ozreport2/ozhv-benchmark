/** 
 * @typedef {{
 *      name: string;
 *      paramText: string;
 *      sep: string;
 * }} TestCase
 **/

const _g = new URLSearchParams(window.location.search);
const userName = _g.get("u") || "default";

/** @type {TestCase[]} */
const testQueue = [];

loadTestData().then(list => {
    testQueue.push(...list);
});

/**
 * @returns {Promise<TestCase[]>}
 */
async function loadTestData() {
    try {
        const response = await fetch(`./api/list.jsp?user=${userName}`);
        const result = await response.json();
        if (Array.isArray(result)) {
            const filtered = result.filter(item => {
                return item
                    && typeof item.name == "string" && item.name
                    && typeof item.paramText == "string" && item.paramText
                    && typeof item.sep == "string" && item.sep
            }).map(item => {
                const { name, paramText, sep } = item;
                return { name, paramText, sep };
            });
            if (filtered.length > 0) {
                return filtered;
            }
        }
    } catch (error) {
        console.error('네트워크 에러:', error);
    }

    return [
        "Dataset_0100", "Dataset_0500", "Dataset_1000",
        "PDFDoc_2", "PDFDoc_3", "PDFDoc_6", // "PDFDoc_20",
        "OZD_01", "OZD_10", "OZD_20",
        "MultiDoc_02", "MultiDoc_10", "MultiDoc_20"
    ].map(name => {
        const p = ["connection.servlet=MACRO_SVURL"];
        const [testClass, scaleName] = name.split("_");
        switch (testClass) {
            case "Dataset": {
                p.push("connection.reportname=user/kimhono97/benchmark/csv.ozr");
                switch (parseInt(scaleName)) {
                    case 100:
                    default:
                        break;
                    case 500:
                        p.push("connection.pcount=1");
                        p.push("connection.args1=dataset=Google_585K");
                        break;
                    case 1000:
                        p.push("connection.pcount=1");
                        p.push("connection.args1=dataset=AMD_955K");
                        break;
                }
                break;
            }
            case "PDFDoc": {
                switch (parseInt(scaleName)) {
                    case 2:
                    default:
                        p.push("connection.reportname=user/kimhono97/benchmark/TS_2M.pdf");
                        break;
                    case 3:
                        p.push("connection.reportname=user/kimhono97/benchmark/CSS_3M.pdf");
                        break;
                    case 6:
                        p.push("connection.reportname=user/kimhono97/benchmark/JS_6M.pdf");
                        break;
                    case 20:
                        p.push("connection.reportname=user/kimhono97/benchmark/PDF_21M.pdf");
                        break;
                }
                break;
            }
            case "OZD": {
                switch (parseInt(scaleName)) {
                    case 1:
                    default:
                        p.push("connection.openfile=ozp://user/kimhono97/benchmark/ASalesReport.ozd");
                        break;
                    case 10:
                        p.push("connection.openfile=ozp://user/kimhono97/benchmark/Image_14M.ozd");
                        break;
                    case 20:
                        p.push("connection.openfile=ozp://user/kimhono97/benchmark/Image_24M.ozd");
                        break;
                }
                break;
            }
            case "MultiDoc": {
                const count = parseInt(scaleName) || 2;
                p.push("global.inheritparameter=true");
                p.push("export.saveonefile=true");
                p.push(`viewer.childcount=${count - 1}`);
                p.push("connection.reportname=user/kimhono97/benchmark/SignPad_1.ozr");
                for (let i=1; i<count; i++) {
                    p.push(`child${i}.connection.reportname=user/kimhono97/benchmark/SignPad_${i%4+1}.ozr`);
                }
                break;
            }
            default:
                break;
        }

        const sep = "\n"
        const paramText = p.join(sep);
        return {
            name,
            paramText,
            sep,
        };
    });
}

/**
 * 
 * @param {TestCase[]} jsonData 
 * @returns {Promise<{
 *      success: boolean;
 *      message: string;
 * }>}
 */
async function updateTestData(jsonData) {
    let errMsg = "";
    try {
        const response = await fetch("./api/update.jsp", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user: userName,
                data: jsonData,
            })
        });

        const { success, message } = await response.json();
        if (typeof success == "boolean" && typeof message == "string") {
            return { success, message };
        }
    } catch (error) {
        console.error('네트워크 에러:', error);
        errMsg = error.toString();
    }
    return {
        success: false,
        message: errMsg,
    };
}

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
/** @type {HTMLIFrameElement} */
const iframe = document.getElementById('testTarget');
const btnStart = document.getElementById('startBtn');
const btnParamEdit = document.getElementById('settingsBtn');
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
        elemSelect.addEventListener("change", ev => {
            onSelectChange();
            elemSelect.blur();
        });
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
    btnParamEdit.disabled = true;
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
    
    const testName = testQueue[currentTestIndex].name;
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
    btnParamEdit.disabled = false;
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
    const testName = testQueue[currentTestIndex].name;
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
    iframe.src = `./rvh/?t=${Date.now()}` + optionParams;
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

    const testItem = testQueue[currentTestIndex];
    setTimeout(() => updateSummary(testItem.name));
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

    try {
        switch (step) {
            case "ready":
                iframe.contentWindow.postMessage({
                    type: "parameters",
                    paramText: testItem.paramText,
                    sep: testItem.sep,
                }, "*");
                break;
            case "export":
                if (ref && currentIteration >= MAX_ITERATIONS) {
                    const obj = JSON.parse(ref);
                    Object.keys(obj).forEach(k => {
                        const blob = makeBlobFromBase64(obj[k], "application/pdf");
                        const fileName = testItem.name + "_" + (k.endsWith(".pdf") ? k : k + ".pdf");
                        addDownloadLinkLog(fileName, blob);
                    });
                }
                break;
            case "error":
                if (ref) {
                    addErrorLog(ref);
                }
                break;
        }
    } catch (e) {
        addErrorLog(e);
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


let editor = null;
const editingQueue = [];
let selectedEditIndex = 0;
const modal = document.getElementById('settingsModal');
let decorationIds = [];

async function initMonacoEditor(initialValue) {
    await document.fonts.ready;
    return new Promise((resolve) => {
        require.config({ 
            paths: {
                // 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.43.0/min/vs',
                'vs': `lib/monaco-editor/0.55.1/min/vs`,
            }
        });

        require(['vs/editor/editor.main'], function() {
            editor = monaco.editor.create(document.getElementById('monaco-editor'), {
                value: initialValue,
                language: 'ini',
                theme: 'vs-dark',
                automaticLayout: true,
                fontSize: 16,
                fontFamily: '"Cascadia Code", "Courier New", Consolas, monospace', // 폰트 종류 명시
                wordWrap: "on",
                renderWhitespace: "all",
                mouseWheelZoom: true,
                renderLineHighlightOnlyWhenFocus: true,
                glyphMargin: true,
            });
            
            editor.onDidChangeModelContent(() => {
                const selectedItem = editingQueue[selectedEditIndex];
                if (selectedItem) {
                    selectedItem.paramText = editor.getValue();
                    selectedItem.sep = editor.getModel().getEOL();
                }
                updateGitGutter();
            });

            resolve();
        });
    });
}

function updateGitGutter() {
    const original = testQueue[selectedEditIndex].paramText.split('\n');
    const modified = editor.getValue().split('\n');
    
    let newDecorations = [];

    // 간단한 비교 로직 (더 정확한 비교를 위해 diff 라이브러리를 쓸 수도 있음)
    modified.forEach((line, index) => {
        const lineNum = index + 1;
        
        if (!original[index]) {
            // 원본보다 줄이 많아짐 (추가)
            newDecorations.push({
                range: new monaco.Range(lineNum, 1, lineNum, 1),
                options: { isWholeLine: true, linesDecorationsClassName: 'git-line-added' }
            });
        } else if (original[index] !== line) {
            // 내용이 다름 (변경)
            newDecorations.push({
                range: new monaco.Range(lineNum, 1, lineNum, 1),
                options: { isWholeLine: true, linesDecorationsClassName: 'git-line-modified' }
            });
        }
    });

    // 기존에 그려진 데코레이션 삭제하고 새로 그림
    decorationIds = editor.deltaDecorations(decorationIds, newDecorations);
}

btnParamEdit.addEventListener("click", async () => {
    editingQueue.length = 0;
    editingQueue.push(... JSON.parse(JSON.stringify(testQueue))); // 편집용 복사본 생성
    modal.style.display = "block";

    if (!editor) {
        await initMonacoEditor(editingQueue[0].paramText);
    }

    selectEditItem(0); // 첫 번째 항목 선택 상태로 시작
    renderModalList();
});

function renderModalList() {
    const listContainer = document.getElementById('modalTestCaseList');
    listContainer.innerHTML = '';
    
    editingQueue.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `editor-item ${index === selectedEditIndex ? 'active' : ''}`;
        
        // 삭제 버튼
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '✕';
        delBtn.className = 'btn-delete-item';
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteItem(index);
        });

        // 이름 입력 인풋
        const nameInput = document.createElement('input');
        nameInput.value = item.name;
        nameInput.placeholder = "항목 이름 입력...";
        nameInput.addEventListener("input", (e) => {
            editingQueue[index].name = e.target.value;
        });
        
        // 인풋 클릭 시에도 부모의 onclick(항목 전환)이 발생하도록 하되, 
        // 이미 선택된 상태라면 이벤트 전파를 막아 포커스를 유지합니다.
        nameInput.addEventListener("click", (e) => {
            if (index === selectedEditIndex) {
                e.stopPropagation();
            }
        });

        div.appendChild(document.createTextNode(`Case ${index + 1}`));
        div.appendChild(delBtn);
        div.appendChild(nameInput);
        
        // 항목 클릭 시 전환 로직
        div.addEventListener("click", () => {
            if (selectedEditIndex !== index) {
                selectEditItem(index);
            }
        });
        
        listContainer.appendChild(div);
    });
}

function selectEditItem(index) {
    // 1. 인덱스 업데이트
    selectedEditIndex = index;

    // 2. UI 클래스 갱신 (리스트 내 모든 항목의 active 클래스 제거/추가)
    const items = document.querySelectorAll('.editor-item');
    items.forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });

    // 3. 에디터 내용 동기화
    if (editor && editingQueue[index]) {
        // setValue를 호출하면 커서 위치가 초기화되므로 값이 다를 때만 갱신
        if (editor.getValue() !== editingQueue[index].paramText) {
            editor.setValue(editingQueue[index].paramText);
        }
    }
}

function deleteItem(index) {
    if (editingQueue.length <= 1) {
        alert("최소 하나 이상의 테스트 케이스가 필요합니다.");
        return;
    }
    editingQueue.splice(index, 1);
    // 삭제 후 인덱스 보정
    if (selectedEditIndex >= editingQueue.length) {
        selectedEditIndex = editingQueue.length - 1;
    }
    renderModalList();
    selectEditItem(selectedEditIndex);
}

function getFilteredEditingQueue() {
    return editingQueue.filter(item => {
        const isNameEmpty = !item.name || item.name.trim() === "";
        const isContentEmpty = !item.paramText || item.paramText.trim() === "";
        return !isNameEmpty && !isContentEmpty;
    });
}

document.getElementById('saveSettings').addEventListener("click", () => {
    const filteredQueue = getFilteredEditingQueue();
    if (filteredQueue.length === 0) {
        alert("유효한 테스트 케이스가 없습니다. (이름과 내용을 모두 입력해주세요)");
        return;
    }
    
    testQueue.length = 0;
    testQueue.push(...filteredQueue);
    
    modal.style.display = "none";
    alert(`저장 완료! (총 ${testQueue.length}개 항목 반영)`);
});

document.getElementById('closeSettings').addEventListener("click", () => {
    modal.style.display = "none";
});

document.getElementById('refreshSettings').addEventListener("click", async () => {
    const list = await loadTestData();
    editingQueue.length = 0;
    editingQueue.push(...list);
    selectEditItem(0);
    renderModalList();
});

document.getElementById('uploadSettings').addEventListener("click", async () => {
    const filteredQueue = getFilteredEditingQueue();
    if (filteredQueue.length === 0) {
        alert("유효한 테스트 케이스가 없습니다. (이름과 내용을 모두 입력해주세요)");
        return;
    }
    const list = await loadTestData();
    if (JSON.stringify(filteredQueue) == JSON.stringify(list)) {
        alert("변경사항이 없습니다.");
        return;
    }

    const result = await updateTestData(filteredQueue);
    if (!result.success) {
        console.error('업데이트 실패:', result.message);
        alert('실패: ' + result.message);
        return;
    }

    console.log('업데이트 성공:', result.message);
    alert('성공: ' + result.message);
    editingQueue.length = 0;
    editingQueue.push(...filteredQueue);
    selectEditItem(0);
    renderModalList();
});

document.getElementById('addTestCase').addEventListener("click", () => {
    const newCase = {
        name: "New Test Case",
        paramText: "connection.servlet=MACRO_SVURL",
        sep: "\n",
    };
    editingQueue.push(newCase);
    selectedEditIndex = editingQueue.length - 1; // 새로 만든 항목으로 바로 이동
    renderModalList();
    if (editor) {
        editor.setValue(newCase.paramText);
    }
});


function loadViewerPaths(svurl) {
    const sep = "$SEP_BENCHMARK$";
    return fetch(`${svurl}oz/dev_test/dev_test_manager.jsp?directories=viewers&sep=${sep}`)
    .then(res => res.text())
    .then(text => {
        const list = text.split(sep);
        return list.map(name => {
            const url = `${svurl}oz/viewers/${name}/`;
            return { name, url };
        });
    });
}

loadViewerPaths("https://dev-test.oz4cs.com/")
.then(items => {
    /** @type {HTMLSelectElement|null} */
    const elemSelect = document.getElementById("rvurl_select");
    if (!elemSelect) {
        return;
    }

    items.forEach(item => {
        const elemOption = document.createElement("option");
        elemOption.innerHTML = item.name;
        elemOption.value = item.url;
        elemSelect.appendChild(elemOption);
    });
})
.catch(e => {
    console.error("Failed to load RVH Paths from server", e);
});