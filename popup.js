let assignments = {};
let allAssignments = {};
let totalWight = 0;
let count = 1;

const SEMESTER_DATES = [
    { month: 0, day: 4 },  
    { month: 5, day: 20 },  // May 15 - Spring semester end
    { month: 7, day: 18 },  // August 20 - Fall semester start
    { month: 11, day: 2 }  // December 20 - Fall semester end
];
async function checkAndClearOldData()
{
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();

    const lastClearData = await chrome.storage.local.get('_lastClearDate');
    const lastClear = lastClearData._lastClearDate || null;

    let shouldClear = false;

    for (const date of SEMESTER_DATES) {
        const clearDate = new Date(currentYear, date.month, date.day);
        if (
            currentMonth === date.month &&
            currentDay >= date.day &&
            (!lastClear || new Date(lastClear) < clearDate)
        ) {
            shouldClear = true;
            break;
        }
    }

    if (shouldClear) {
        await clearAllCourseData();
        await chrome.storage.local.set({ _lastClearDate: now.toISOString() });
        console.log('Semester reset performed:', now.toISOString());
    }
}
async function clearAllCourseData()
{
    const allLocal = await chrome.storage.local.get(null);
    const allSync = await chrome.storage.sync.get(null);

    const localKeysToDelete = Object.keys(allLocal).filter(key =>
        !key.startsWith('_')
    );

    const syncKeysToDelete = Object.keys(allSync).filter(key =>
        key.startsWith('_assignments_') ||
        key.startsWith('_totalWeight_') ||
        key.startsWith('_count_')
    );

    const localKeysWithUnderscore = Object.keys(allLocal).filter(key =>
        key.startsWith('_allAssignments_') ||
        key === '_manualAssignments'
    );

    const allLocalKeysToDelete = [...localKeysToDelete, ...localKeysWithUnderscore];

    if (allLocalKeysToDelete.length > 0) {
        await chrome.storage.local.remove(allLocalKeysToDelete);
    }
    if (syncKeysToDelete.length > 0) {
        await chrome.storage.sync.remove(syncKeysToDelete);
    }

    console.log('Cleared local keys:', allLocalKeysToDelete);
    console.log('Cleared sync keys:', syncKeysToDelete);
}
async function getCourseKey()
{
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.title;
}

async function saveGlobalState()
{
    const courseName = await getCourseKey();
    const serialized = {};
    for (const [typeName, typeObj] of Object.entries(assignments)) {
        serialized[typeName] = {
            weight: typeObj.weight,
            assignmentsList: Array.from(typeObj.assignmentsList)
        };
    }
    await chrome.storage.sync.set({
        [`_assignments_${courseName}`]: serialized,
        [`_totalWeight_${courseName}`]: totalWight,
        [`_count_${courseName}`]: count
    });
    await chrome.storage.local.set({
        [`_allAssignments_${courseName}`]: allAssignments
    });
}

async function restoreGlobalState()
{
    const courseName = await getCourseKey();
    const syncData = await chrome.storage.sync.get([
        `_assignments_${courseName}`,
        `_totalWeight_${courseName}`,
        `_count_${courseName}`
    ]);
    const localData = await chrome.storage.local.get([`_allAssignments_${courseName}`]);

    const savedAssignments = syncData[`_assignments_${courseName}`];
    const savedTotalWeight = syncData[`_totalWeight_${courseName}`];
    const savedCount = syncData[`_count_${courseName}`];
    const savedAllAssignments = localData[`_allAssignments_${courseName}`];

    if (savedAssignments) {
        assignments = {};
        for (const [typeName, typeObj] of Object.entries(savedAssignments)) {
            assignments[typeName] = {
                weight: parseFloat(typeObj.weight),
                assignmentsList: new Set(Array.isArray(typeObj.assignmentsList) ? typeObj.assignmentsList : [])
            };
        }
    } else {
        assignments = {};
    }

    if (savedAllAssignments) {
        allAssignments = {};
        for (const [key, val] of Object.entries(savedAllAssignments)) {
            allAssignments[key] = parseFloat(val);
        }
    } else {
        allAssignments = {};
    }

    totalWight = savedTotalWeight !== undefined ? parseFloat(savedTotalWeight) : 0;
    count = savedCount !== undefined ? parseInt(savedCount) : 1;
}

async function saveManualAssignments(courseName, name, earned, total)
{
    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    if (!manual[courseName]) manual[courseName] = {};
    manual[courseName][name] = [`${earned}/${total}`];
    await chrome.storage.local.set({ _manualAssignments: manual });
}

async function deleteManualAssignment(courseName, key)
{
    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    if (manual[courseName]) {
        delete manual[courseName][key];
        await chrome.storage.local.set({ _manualAssignments: manual });
    }
}

function assignmentToForm(item, key)
{
    let tbodyRef = document.getElementById('assignment').getElementsByTagName('tbody')[0];
    let row = tbodyRef.insertRow(-1);
    let assignmentTitle = row.insertCell(0);
    assignmentTitle.classList.add('clickableAssignment');
    assignmentTitle.addEventListener('click', async () => {
        const isOn = assignmentTitle.dataset.active === 'true';
        if (isOn) {
            assignmentTitle.dataset.active = 'false';
            assignmentTitle.style.backgroundColor = 'transparent';
            const savedCategory = assignmentTitle.dataset.savedCategory;
            if (savedCategory && assignments[savedCategory]) {
                assignments[savedCategory].assignmentsList.delete(key);
            }
        } else {
            const activeButton = document.querySelector('.assignmentTypeButton.active');
            if (!activeButton) return;
            assignmentTitle.dataset.active = 'true';
            assignmentTitle.style.backgroundColor = getComputedStyle(activeButton).backgroundColor;
            assignmentTitle.dataset.savedCategory = activeButton.textContent;
            Object.values(assignments).forEach(a => a.assignmentsList.delete(key));
            assignments[activeButton.textContent].assignmentsList.add(key);
        }
        await saveGlobalState();
    });

    assignmentTitle.textContent = key;
    let pointCell = row.insertCell(1);
    let t = item[0];

    if (t.includes("/")) {
        const parts = t.split("/");
        const earned = parseFloat(parts[0]) || 0;
        const total = parseFloat(parts[1]) || 0;

        if (total === 0) {
            pointCell.textContent = t;
            return;
        }

        let input = document.createElement('input');
        input.type = 'number';
        input.min = "0";
        input.max = total;
        input.value = earned;
        input.dataset.total = total;
        pointCell.appendChild(input);
        pointCell.appendChild(document.createTextNode(` / ${total}`));
        let percentageSpan = document.createElement('span');
        const initialPct = ((earned / total) * 100);
        percentageSpan.textContent = `(${initialPct.toFixed(2)}%)`;
        input.addEventListener('input', async () => {
            const value = parseFloat(input.value) || 0;
            let pct = (value / total) * 100;
            if (pct > 100) pct = 100;
            percentageSpan.textContent = `(${pct.toFixed(2)}%)`;
            allAssignments[key] = parseFloat(pct.toFixed(2));
            await saveGlobalState();
        });
        pointCell.appendChild(percentageSpan);
        let deleteBtn = document.createElement('button');
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener('click', async () => {
            const savedCategory = assignmentTitle.dataset.savedCategory;
            if (savedCategory && assignments[savedCategory]) {
                assignments[savedCategory].assignmentsList.delete(key);
            }
            pointCell.parentElement.remove();
            delete allAssignments[key];
            const courseName = await getCourseKey();
            await deleteManualAssignment(courseName, key);
            const storedData = await chrome.storage.local.get(courseName);
            const courseData = storedData[courseName] || { courseName };
            delete courseData[key];
            await chrome.storage.local.set({ [courseName]: courseData });
            await saveGlobalState();
        });
        pointCell.appendChild(deleteBtn);
    } else if (t.includes("%")) {
        const initialPct = parseFloat(t.replace("%", ""));
        let input = document.createElement('input');
        input.type = 'number';
        input.min = "0";
        input.max = "100";
        input.value = initialPct;
        input.dataset.total = 100;
        pointCell.appendChild(input);
        let percentageSpan = document.createElement('span');
        percentageSpan.textContent = `(${initialPct.toFixed(2)}%)`;
        input.addEventListener('input', async () => {
            let pct = parseFloat(input.value) || 0;
            if (pct > 100) pct = 100;
            percentageSpan.textContent = `(${pct.toFixed(2)}%)`;
            allAssignments[key] = parseFloat(pct.toFixed(2));
            await saveGlobalState();
        });
        pointCell.appendChild(percentageSpan);
        let deleteBtn = document.createElement('button');
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener('click', async () => {
            const savedCategory = assignmentTitle.dataset.savedCategory;
            if (savedCategory && assignments[savedCategory]) {
                assignments[savedCategory].assignmentsList.delete(key);
            }
            pointCell.parentElement.remove();
            delete allAssignments[key];
            const courseName = await getCourseKey();
            await deleteManualAssignment(courseName, key);
            const storedData = await chrome.storage.local.get(courseName);
            const courseData = storedData[courseName] || { courseName };
            delete courseData[key];
            await chrome.storage.local.set({ [courseName]: courseData });
            await saveGlobalState();
        });
        pointCell.appendChild(deleteBtn);
    } else {
        pointCell.textContent = t;
    }
}

async function displayStoredData()
{
    await restoreGlobalState();
    const courseName = await getCourseKey();
    try {
        const storedData = await chrome.storage.local.get(courseName);
        const manualData = await chrome.storage.local.get('_manualAssignments');
        const manual = manualData._manualAssignments?.[courseName] || {};

        document.getElementById('result').textContent += `${courseName}:\n`;

        if (storedData[courseName]) {
            const courseData = storedData[courseName];
            for (const key in courseData) {
                if (key !== 'courseName' && key !== 'Order' && key !== 'undefined' && key !== '_categories') {
                    if (key in manual) continue;
                    assignmentToForm(courseData[key], key);
                    const val = courseData[key][0];
                    if (val && val.includes('/')) {
                        const [earned, total] = val.split('/').map(Number);
                        if (!isNaN(earned) && !isNaN(total) && total > 0) {
                            allAssignments[key] = parseFloat((earned / total * 100).toFixed(2));
                        }
                    } else if (val && val.includes('%')) {
                        const pct = parseFloat(val.replace('%', ''));
                        if (!isNaN(pct)) allAssignments[key] = pct;
                    }
                }
            }
        }

        for (const key in manual) {
            assignmentToForm(manual[key], key);
            const val = manual[key][0];
            const [earned, total] = val.split('/').map(Number);
            if (!isNaN(earned) && !isNaN(total) && total > 0) {
                allAssignments[key] = parseFloat((earned / total * 100).toFixed(2));
            }
        }

        for (const [typeName, typeObj] of Object.entries(assignments)) {
            const parent = document.getElementById('types');
            const newBtn = document.createElement('button');
            newBtn.textContent = typeName;
            newBtn.classList.add('assignmentTypeButton');
            newBtn.style.backgroundColor = `var(--color-${count - Object.keys(assignments).length + Object.keys(assignments).indexOf(typeName)})`;
            parent.appendChild(newBtn);
        }

        for (const [typeName, typeObj] of Object.entries(assignments)) {
            const btn = Array.from(document.querySelectorAll('.assignmentTypeButton'))
                .find(b => b.textContent === typeName);
            const color = btn ? getComputedStyle(btn).backgroundColor : 'transparent';
            for (const assignKey of typeObj.assignmentsList) {
                document.querySelectorAll('.clickableAssignment').forEach(cell => {
                    if (cell.textContent === assignKey) {
                        cell.dataset.active = 'true';
                        cell.dataset.savedCategory = typeName;
                        cell.style.backgroundColor = color;
                    }
                });
            }
        }
    } catch (error) {
        console.error("Error retrieving stored data:", error);
    }
}

function createAssignmentType()
{
    let buttonPress = document.getElementById('createAssignmentType');
    buttonPress.addEventListener('click', async () => {
        let assignmentType = document.getElementById('assignmentType').value;
        let weight = document.getElementById('weight').value;
        if (assignmentType && weight && totalWight + parseFloat(weight) <= 100 && !document.getElementById('types').textContent.includes(assignmentType)) {
            const parent = document.getElementById('types');
            const newBtn = document.createElement('button');
            newBtn.textContent = assignmentType;
            newBtn.classList.add('assignmentTypeButton');
            newBtn.style.backgroundColor = `var(--color-${count})`;
            parent.appendChild(newBtn);
            totalWight += parseFloat(weight);
            assignments[assignmentType] = {
                weight: parseFloat(weight),
                assignmentsList: new Set()
            };
            count++;
            await saveGlobalState();
        }
    });

    let clearBtn = document.getElementById('clearStorage');
    clearBtn.addEventListener('click', async () => {
        const parent = document.getElementById('types');
        parent.innerHTML = '';
        totalWight = 0;
        count = 1;
        assignments = {};
        allAssignments = {};
        document.querySelectorAll('.clickableAssignment').forEach(cell => {
            cell.style.backgroundColor = 'transparent';
            cell.dataset.disabled = 'false';
            cell.dataset.savedCategory = '';
            cell.dataset.savedValue = '';
        });
        await saveGlobalState();
    });
}

function calculateGrade()
{
    let weightedTotal = 0;
    let usedWeight = 0;

    for (const [typeName, typeObj] of Object.entries(assignments)) {
        if (!typeObj || typeof typeObj !== "object") continue;
        if (typeof typeObj.weight !== "number") continue;

        const list = typeObj.assignmentsList instanceof Set
            ? Array.from(typeObj.assignmentsList)
            : Array.isArray(typeObj.assignmentsList)
                ? typeObj.assignmentsList
                : [];

        const scores = [];
        for (const aKey of list) {
            const pct = allAssignments[aKey];
            if (typeof pct === "number" && !Number.isNaN(pct)) {
                scores.push(pct);
            }
        }

        if (scores.length === 0) continue;

        const avg = scores.reduce((sum, v) => sum + v, 0) / scores.length;
        weightedTotal += avg * (typeObj.weight / 100);
        usedWeight += typeObj.weight;
    }

    const finalPercent = usedWeight > 0 ? (weightedTotal * (100 / usedWeight)) : 0;
    document.getElementById("finalGrade").textContent = `Current Grade: ${finalPercent.toFixed(2)}%`;
    return finalPercent;
}

async function saveData()
{
    const courseName = await getCourseKey();
    const storedData = await chrome.storage.local.get(courseName);
    const courseData = storedData[courseName] || { courseName };

    const manualData = await chrome.storage.local.get('_manualAssignments');
    const manual = manualData._manualAssignments?.[courseName] || {};

    const rows = document.getElementById('assignment').getElementsByTagName('tbody')[0].rows;
    for (const row of rows) {
        const key = row.cells[0].textContent;
        const input = row.cells[1].querySelector('input');
        if (input) {
            const earned = input.value;
            const total = input.dataset.total;
            if (key in manual) {
                manual[key] = [`${earned}/${total}`];
            } else {
                courseData[key] = [`${earned}/${total}`];
            }
        }
    }

    delete courseData['_categories'];

    const updatedManual = manualData._manualAssignments || {};
    updatedManual[courseName] = manual;

    await chrome.storage.local.set({ [courseName]: courseData });
    await chrome.storage.local.set({ _manualAssignments: updatedManual });
    await saveGlobalState();
    alert('Saved!');
}

async function resetToPageData()
{
    if (!confirm('This will delete all manually added assignments and category changes. Are you sure?')) return;

    const courseName = await getCourseKey();

    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    delete manual[courseName];
    await chrome.storage.local.set({ _manualAssignments: manual });

    assignments = {};
    allAssignments = {};
    totalWight = 0;
    count = 1;
    await saveGlobalState();

    document.getElementById('types').innerHTML = '';
    const tbody = document.getElementById('assignment').getElementsByTagName('tbody')[0];
    tbody.innerHTML = '';
    document.getElementById('result').textContent = '';
    document.getElementById('finalGrade').textContent = 'Current Grade: --%';

    await displayStoredData();
}

function makeAssignment()
{
    document.getElementById('newAssignment').addEventListener('click', () => {
        document.getElementById('newAssignmentName').value = '';
        document.getElementById('newAssignmentTotal').value = '';
        document.getElementById('newAssignmentEarned').value = '';
        document.getElementById('modalOverlay').style.display = 'flex';
    });
    document.getElementById('cancelAssignment').addEventListener('click', () => {
        document.getElementById('modalOverlay').style.display = 'none';
    });
    document.getElementById('submitAssignment').addEventListener('click', async () => {
        const name = document.getElementById('newAssignmentName').value;
        const total = document.getElementById('newAssignmentTotal').value;
        const earned = document.getElementById('newAssignmentEarned').value;
        if (!name || isNaN(total) || isNaN(earned) || total <= 0) {
            alert('Please enter valid assignment details.');
            return;
        }
        assignmentToForm([`${earned}/${total}`], name);
        allAssignments[name] = parseFloat(((earned / total) * 100).toFixed(2));
        const courseName = await getCourseKey();
        await saveManualAssignments(courseName, name, earned, total);
        await saveGlobalState();
        document.getElementById('modalOverlay').style.display = 'none';
    });
    document.getElementById('modalOverlay').addEventListener('click', (e) => {
        if (e.target === document.getElementById('modalOverlay')) {
            document.getElementById('modalOverlay').style.display = 'none';
        }
    });
}
async function init()
{
    await checkAndClearOldData();
    createAssignmentType();
    await displayStoredData();
    makeAssignment();
}
init();

document.getElementById('types').addEventListener('click', (event) => {
    const x = event.target.closest('.assignmentTypeButton');
    if (!x) return;
    document.querySelectorAll('.assignmentTypeButton').forEach(b => b.classList.remove('active'));
    x.classList.add('active');
});

document.getElementById("calcGrade").addEventListener("click", calculateGrade);
document.getElementById('saveData').addEventListener('click', saveData);
document.getElementById('resetToPage').addEventListener('click', resetToPageData);