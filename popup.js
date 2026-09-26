// category name -> { weight, colorIndex, assignmentsList: Set<assignment key> }
let assignments = {};
// assignment key -> { kind: 'points' | 'percent' | 'text', earned, total, text, manual }
let rowData = {};
// assignment keys in display order (page order, then manually added)
let rowOrder = [];
// assignment key -> percent score (only for rows that have a numeric score)
let allAssignments = {};
let deletedAssignments = new Set();
let activeCategory = null;
let expandedCategories = new Set();
let deletedOpen = true;
let lastClickedKey = null;
let courseName = null;
// key -> { value, base }: scores the user changed on Brightspace-provided assignments.
// `base` is the original page value, so a reset (or a newly posted grade) can drop the edit.
let scoreEdits = {};

// Number of category colors defined as --color-1 ... --color-N in style.css.
const COLOR_COUNT = 5;
const SPECIAL_KEYS = ['courseName', 'Order', 'undefined', '_categories'];

// Limits that keep user-entered data (and chrome.storage usage) small.
const MAX_ASSIGNMENT_NAME_LENGTH = 40;
const MAX_CATEGORY_NAME_LENGTH = 25;
const MAX_POINTS = 100000;
const MAX_MANUAL_ASSIGNMENTS = 100;
const MAX_CATEGORIES = 20;
const SVG_NS = 'http://www.w3.org/2000/svg';

const SEMESTER_DATES = [
    { month: 0, day: 4 },
    { month: 5, day: 20 },  // May 15 - Spring semester end
    { month: 7, day: 18 },  // August 20 - Fall semester start
    { month: 11, day: 2 }  // December 20 - Fall semester end
];
// Runs when the popup opens. If today is on or after a semester boundary date
// (SEMESTER_DATES) and data has not been cleared since then, wipes all saved course data once.
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
// Removes every course's scraped grades, categories, deleted list, score edits and manual
// assignments from local and sync storage. Other "_" keys (e.g. _lastClearDate) are kept.
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
        key.startsWith('_deletedAssignments_') ||
        key.startsWith('_scoreEdits_') ||
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
// Returns the active tab's title, which identifies the course in storage. Cached after the first lookup.
async function getCourseKey()
{
    if (courseName === null) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        courseName = tab.title;
    }
    return courseName;
}

// Turns a Brightspace tab title into a readable course name, e.g.
// "Grades - Spring 2026 ANTH 10000-017 LEC - Purdue University System" -> "Spring 2026 ANTH 10000-017 LEC".
function getDisplayCourseName(fullCourseName)
{
    // Extract course name from format like "Grades - Spring 2026 ANTH 10000-017 LEC - Purdue University System:"
    const dashParts = fullCourseName.split(' - ');
    if (dashParts.length >= 2) {
        // Get the part after the first dash and before the last dash
        const coursePart = dashParts.slice(1, -1).join(' - ').trim();
        if (coursePart) {
            return coursePart;
        }
    }
    return fullCourseName;
}

// ---------- helpers ----------

// Creates a DOM element with an optional class name and text content.
function el(tag, className, text)
{
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

// Creates an SVG element (which needs the SVG namespace) with the given attributes.
function svgEl(tag, attrs = {})
{
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
}

// Icon shapes used by iconSvg(): the dropdown arrow, the circled X (delete/remove)
// and the circled plus (restore).
const ICONS = {
    arrow: {
        viewBox: '0 0 24 24',
        paths: ['M12.7071 14.7071C12.3166 15.0976 11.6834 15.0976 11.2929 14.7071L6.29289 9.70711C5.90237 9.31658 5.90237 8.68342 6.29289 8.29289C6.68342 7.90237 7.31658 7.90237 7.70711 8.29289L12 12.5858L16.2929 8.29289C16.6834 7.90237 17.3166 7.90237 17.7071 8.29289C18.0976 8.68342 18.0976 9.31658 17.7071 9.70711L12.7071 14.7071Z']
    },
    plus: {
        viewBox: '0 -0.5 17 17',
        transform: 'translate(1, 0)',
        paths: [
            'M8.021,0.114 C3.627,0.114 0.052,3.668 0.052,8.036 C0.052,12.404 3.627,15.958 8.021,15.958 C12.416,15.958 15.99,12.404 15.99,8.036 C15.99,3.668 12.415,0.114 8.021,0.114 L8.021,0.114 Z M8.013,14.07 C4.684,14.07 1.973,11.346 1.973,7.999 C1.973,4.652 4.684,1.928 8.013,1.928 C11.342,1.928 14.052,4.653 14.052,7.999 C14.052,11.347 11.342,14.07 8.013,14.07 L8.013,14.07 Z',
            'M7.996,11.969 C7.342,11.969 7.037,11.532 7.037,11.238 L7.037,8.983 L4.813,8.983 C4.548,8.983 4.031,8.685 4.031,7.997 C4.031,7.343 4.469,7.038 4.763,7.038 L7.034,7.038 L7.034,4.801 C7.034,4.537 7.332,4.019 8.02,4.019 C8.674,4.019 8.979,4.457 8.979,4.751 L8.979,7.036 L11.215,7.036 C11.48,7.036 11.998,7.335 11.998,8.023 C11.998,8.676 11.56,8.981 11.266,8.981 L8.981,8.981 L8.981,11.187 C8.982,11.45 8.685,11.969 7.996,11.969 L7.996,11.969 Z'
        ]
    },
    x: {
        viewBox: '0 -0.5 17 17',
        transform: 'translate(1, 0)',
        paths: [
            'M13.646,2.371 C10.535,-0.739 5.469,-0.74 2.358,2.371 C-0.753,5.483 -0.752,10.548 2.358,13.66 C5.469,16.77 10.534,16.771 13.646,13.66 C16.758,10.547 16.757,5.483 13.646,2.371 L13.646,2.371 Z M3.587,12.431 C1.148,9.993 1.146,6.028 3.58,3.594 C6.014,1.159 9.979,1.162 12.418,3.6 C14.856,6.038 14.857,10.004 12.424,12.438 C9.988,14.872 6.024,14.869 3.587,12.431 L3.587,12.431 Z',
            'M10.164,11.063 C9.982,11.063 9.845,10.991 9.776,10.922 L8.009,9.157 L6.314,10.852 C6.248,10.918 6.095,10.998 5.891,10.998 C5.738,10.998 5.507,10.952 5.288,10.733 C5.067,10.513 5.018,10.295 5.017,10.153 C5.013,9.965 5.086,9.823 5.157,9.753 L6.881,8.028 L5.201,6.35 C5.049,6.197 4.922,5.723 5.321,5.325 C5.546,5.1 5.767,5.053 5.914,5.053 C6.097,5.053 6.234,5.125 6.301,5.194 L8.009,6.9 L9.705,5.204 C9.773,5.137 9.925,5.058 10.129,5.058 C10.283,5.058 10.514,5.104 10.733,5.324 C11.111,5.703 11.035,6.134 10.864,6.304 L9.138,8.03 L10.875,9.766 C10.942,9.834 11.021,9.986 11.021,10.19 C11.021,10.344 10.976,10.573 10.756,10.792 C10.531,11.016 10.311,11.063 10.164,11.063 L10.164,11.063 L10.164,11.063 Z'
        ]
    }
};

// Builds one of the ICONS as an inline SVG that takes its color from the surrounding text color.
function iconSvg(name, className)
{
    const icon = ICONS[name];
    const svg = svgEl('svg', { viewBox: icon.viewBox, fill: 'currentColor', 'aria-hidden': 'true' });
    if (className) svg.setAttribute('class', className);
    const group = svgEl('g', { 'fill-rule': 'evenodd' });
    if (icon.transform) group.setAttribute('transform', icon.transform);
    icon.paths.forEach(d => group.appendChild(svgEl('path', { d })));
    svg.appendChild(group);
    return svg;
}

// Rounds a number to 2 decimal places.
function round2(n)
{
    return Math.round(n * 100) / 100;
}

// Formats a number for display without trailing zeros (25.00 -> "25").
function fmt(n)
{
    return String(round2(n));
}

// Maps a category's colorIndex to a CSS color variable, wrapping around after COLOR_COUNT colors.
function colorVar(colorIndex)
{
    return `var(--color-${((colorIndex - 1) % COLOR_COUNT) + 1})`;
}

// Picks the palette color used by the fewest categories (the first one wins ties),
// so a removed category frees its color and colors only repeat once all are in use.
function nextColorIndex()
{
    const uses = new Array(COLOR_COUNT).fill(0);
    Object.values(assignments).forEach(c => uses[(c.colorIndex - 1) % COLOR_COUNT]++);
    return uses.indexOf(Math.min(...uses)) + 1;
}

// Sum of all category weights (the "allocated" part of the pie chart).
function totalWeight()
{
    return Object.values(assignments).reduce((sum, c) => sum + c.weight, 0);
}

// Returns the name of the category an assignment belongs to, or null if it is unassigned.
function categoryOf(key)
{
    for (const [name, obj] of Object.entries(assignments)) {
        if (obj.assignmentsList.has(key)) return name;
    }
    return null;
}

// Moves assignments into a category, first removing them from any other category.
function assignKeys(keys, category)
{
    for (const key of keys) {
        Object.values(assignments).forEach(a => a.assignmentsList.delete(key));
        assignments[category].assignmentsList.add(key);
    }
}

// ---------- persistence ----------

// Saves this course's set of deleted (greyed-out) assignments to local storage.
async function saveDeleted()
{
    const name = await getCourseKey();
    await chrome.storage.local.set({
        [`_deletedAssignments_${name}`]: Array.from(deletedAssignments)
    });
}

// Saves categories (weight, color, assignments) to sync storage and the deleted list to local storage.
async function saveGlobalState()
{
    const name = await getCourseKey();
    const serialized = {};
    for (const [typeName, typeObj] of Object.entries(assignments)) {
        serialized[typeName] = {
            weight: typeObj.weight,
            colorIndex: typeObj.colorIndex,
            assignmentsList: Array.from(typeObj.assignmentsList)
        };
    }
    await chrome.storage.sync.set({ [`_assignments_${name}`]: serialized });
    await saveDeleted();
}

// Loads this course's categories and deleted list from storage into memory.
// Categories saved before colorIndex existed get a color based on their position.
async function restoreGlobalState()
{
    const name = await getCourseKey();
    const syncData = await chrome.storage.sync.get([`_assignments_${name}`]);
    const localData = await chrome.storage.local.get([`_deletedAssignments_${name}`]);

    const savedAssignments = syncData[`_assignments_${name}`] || {};

    assignments = {};
    let position = 0;
    for (const [typeName, typeObj] of Object.entries(savedAssignments)) {
        position++;
        // Categories saved before the pie chart existed have no colorIndex.
        const colorIndex = typeof typeObj.colorIndex === 'number' ? typeObj.colorIndex : position;
        assignments[typeName] = {
            weight: parseFloat(typeObj.weight) || 0,
            colorIndex,
            assignmentsList: new Set(Array.isArray(typeObj.assignmentsList) ? typeObj.assignmentsList : [])
        };
    }

    deletedAssignments = new Set(localData[`_deletedAssignments_${name}`] || []);
}

// Stores (or overwrites) a manually added assignment as "earned/total" under the given course.
async function saveManualAssignments(name, assignmentName, earned, total)
{
    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    if (!manual[name]) manual[name] = {};
    manual[name][assignmentName] = [`${earned}/${total}`];
    await chrome.storage.local.set({ _manualAssignments: manual });
}

// Saves this course's score edits to local storage, or removes the key when there are none.
async function saveScoreEdits()
{
    const name = await getCourseKey();
    if (Object.keys(scoreEdits).length === 0) {
        await chrome.storage.local.remove(`_scoreEdits_${name}`);
    } else {
        await chrome.storage.local.set({ [`_scoreEdits_${name}`]: scoreEdits });
    }
}

// Saves an edited score. Page assignments keep their original value (in `base`) so
// "Reset to Page Data" can restore it; manual assignments are edited in place.
async function persistScore(key)
{
    const info = rowData[key];
    if (!info) return;
    const value = info.kind === 'percent'
        ? [`${info.earned}%`]
        : [`${info.earned}/${info.total}`];
    const name = await getCourseKey();

    if (info.manual) {
        await saveManualAssignments(name, key, info.earned, info.total);
    } else {
        if (JSON.stringify(value) === info.base) delete scoreEdits[key];
        else scoreEdits[key] = { value, base: info.base };
        await saveScoreEdits();
    }
}

// ---------- loading ----------

// Turns the stored array for one assignment into a row description:
// { kind: "points" | "percent" | "text", earned, total } or null when there is no data.
function parseItem(item)
{
    if (!Array.isArray(item) || item.length === 0) return null;

    // Some courses put the grade value in a different column index
    // so find the first meaningful value (percent or points) in the array.
    let t = item.find(v => typeof v === 'string' && (v.includes('/') || v.includes('%') || /^\d/.test(v.trim())));
    if (!t) t = item.find(v => typeof v === 'string' && v.trim() !== '') || item[0];
    t = String(t ?? '');

    if (t.includes('/')) {
        const parts = t.split('/');
        const earned = parseFloat(parts[0]) || 0;
        const total = parseFloat(parts[1]) || 0;
        if (total > 0) return { kind: 'points', earned, total };
    } else if (t.includes('%')) {
        const pct = parseFloat(t.replace('%', ''));
        if (!Number.isNaN(pct)) return { kind: 'percent', earned: pct, total: 100 };
    }
    return { kind: 'text', text: t };
}

// Score as a percentage, clamped to 0-100 and rounded to 2 places.
function percentOf(info)
{
    const pct = Math.min(100, Math.max(0, (info.earned / info.total) * 100));
    return parseFloat(pct.toFixed(2));
}

// Registers one assignment in rowData/rowOrder and records its percent score if it has a numeric one.
// `base` is the original page value (used to detect edits); it is unset for manual assignments.
function addRow(key, item, manual, base)
{
    const info = parseItem(item);
    if (!info) return;
    info.manual = manual;
    info.base = base;
    rowData[key] = info;
    rowOrder.push(key);
    if (info.kind !== 'text') allAssignments[key] = percentOf(info);
}

// Rebuilds all in-memory state from storage (categories, page assignments with score edits applied
// on top, then manual assignments) and renders. Edits made against an older page value are discarded.
async function loadData()
{
    await restoreGlobalState();
    const name = await getCourseKey();

    rowData = {};
    rowOrder = [];
    allAssignments = {};

    try {
        const stored = await chrome.storage.local.get(name);
        const manualData = await chrome.storage.local.get('_manualAssignments');
        const manual = manualData._manualAssignments?.[name] || {};
        const courseData = stored[name] || {};
        const editData = await chrome.storage.local.get(`_scoreEdits_${name}`);
        scoreEdits = editData[`_scoreEdits_${name}`] || {};
        let prunedEdits = false;

        for (const key in courseData) {
            if (SPECIAL_KEYS.includes(key) || key in manual) continue;
            const base = JSON.stringify(courseData[key]);
            let item = courseData[key];
            const edit = scoreEdits[key];
            if (edit) {
                if (edit.base === base) {
                    item = edit.value;
                } else {
                    // Brightspace now reports a different value, so the old edit is stale.
                    delete scoreEdits[key];
                    prunedEdits = true;
                }
            }
            addRow(key, item, false, base);
        }
        for (const key in manual) {
            addRow(key, manual[key], true);
        }
        if (prunedEdits) await saveScoreEdits();
    } catch (error) {
        console.error('Error retrieving stored data:', error);
    }

    if (!activeCategory || !assignments[activeCategory]) {
        activeCategory = Object.keys(assignments)[0] || null;
    }
    render();
}

// ---------- grade calculation ----------

// Assignments in a category that still exist on the page and have not been deleted.
function activeKeys(typeName)
{
    return Array.from(assignments[typeName].assignmentsList)
        .filter(key => rowData[key] && !deletedAssignments.has(key));
}

// Item count and average percent for a category (avg is null when nothing in it has a score).
function categoryStats(typeName)
{
    const keys = activeKeys(typeName);
    const scores = keys
        .map(key => allAssignments[key])
        .filter(pct => typeof pct === 'number' && !Number.isNaN(pct));
    const avg = scores.length > 0 ? scores.reduce((sum, v) => sum + v, 0) / scores.length : null;
    return { count: keys.length, avg };
}

// Computes the course grade and writes it (plus an explanatory note) to the page. Only categories with
// at least one scored assignment count, and their weights are rescaled to make up 100% of the grade,
// so 50% + 25% is graded as 50/75 and 25/75. Returns the percentage.
function calculateGrade()
{
    let weightedSum = 0;
    let usedWeight = 0;
    const emptyCategories = [];

    for (const [typeName, typeObj] of Object.entries(assignments)) {
        const { avg } = categoryStats(typeName);
        if (avg === null) {
            emptyCategories.push(typeName);
            continue;
        }
        weightedSum += avg * typeObj.weight;
        usedWeight += typeObj.weight;
    }

    // Only the categories that have grades count, so their weights are rescaled
    // to make up 100% of the grade (e.g. 50% + 25% is graded as 75% / 75%).
    const finalPercent = usedWeight > 0 ? weightedSum / usedWeight : 0;
    const allocated = totalWeight();

    document.getElementById('finalGrade').textContent =
        usedWeight > 0 ? `Current Grade: ${finalPercent.toFixed(2)}%` : 'Current Grade: --%';

    const notes = [];
    if (usedWeight > 0) {
        notes.push(`Based on ${fmt(usedWeight)}% of course weight`);
        if (emptyCategories.length > 0) notes.push(`no grades yet in ${emptyCategories.join(', ')}`);
        if (allocated < 100) notes.push(`${fmt(100 - allocated)}% unallocated`);
    } else if (allocated === 0) {
        notes.push('Add a category, then assign assignments to it');
    } else {
        notes.push('Assign graded assignments to a category');
    }
    document.getElementById('gradeNote').textContent = notes.join(' · ');

    return finalPercent;
}

// Cheap update used while typing so inputs keep focus (no full re-render):
// refreshes each category's average and the overall grade.
function refreshStats()
{
    document.querySelectorAll('.catAvg').forEach(node => {
        const { avg } = categoryStats(node.dataset.cat);
        node.textContent = avg === null ? 'avg --' : `avg ${avg.toFixed(0)}%`;
    });
    calculateGrade();
}

// ---------- rendering ----------

// Redraws the whole popup from the current state.
function render()
{
    if (!activeCategory || !assignments[activeCategory]) {
        activeCategory = Object.keys(assignments)[0] || null;
    }
    renderHeader();
    renderWeightChart();
    renderCategories();
    renderUnassigned();
    renderDeleted();
    calculateGrade();
}

// Shows the course name at the top of the popup.
function renderHeader()
{
    document.getElementById('result').textContent = getDisplayCourseName(courseName || '');
}

// Selects the category that clicked assignments are added to, and redraws.
function setActiveCategory(name)
{
    activeCategory = name;
    render();
}

// Draws the donut chart (one arc per category on a grey "unallocated" ring) and its legend.
function renderWeightChart()
{
    const chart = document.getElementById('weightChart');
    const legend = document.getElementById('legend');
    chart.textContent = '';
    legend.textContent = '';

    const R = 42;
    const STROKE = 18;
    const C = 2 * Math.PI * R;
    const allocated = totalWeight();

    const svg = svgEl('svg', { viewBox: '0 0 120 120', width: 120, height: 120 });

    const ring = svgEl('circle', { cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': STROKE, style: 'stroke:#e3e5e8' });
    const ringTitle = svgEl('title');
    ringTitle.textContent = `Unallocated – ${fmt(Math.max(0, 100 - allocated))}%`;
    ring.appendChild(ringTitle);
    svg.appendChild(ring);

    let offset = 0;
    for (const [name, obj] of Object.entries(assignments)) {
        const len = (Math.min(obj.weight, 100) / 100) * C;
        const slice = svgEl('circle', {
            cx: 60, cy: 60, r: R, fill: 'none', 'stroke-width': STROKE,
            'stroke-dasharray': `${len} ${C - len}`,
            'stroke-dashoffset': -offset,
            transform: 'rotate(-90 60 60)',
            style: `stroke:${colorVar(obj.colorIndex)};cursor:pointer`
        });
        const title = svgEl('title');
        title.textContent = `${name} – ${fmt(obj.weight)}%`;
        slice.appendChild(title);
        slice.addEventListener('click', () => setActiveCategory(name));
        svg.appendChild(slice);
        offset += len;
    }

    const pctText = svgEl('text', { x: 60, y: 60, 'text-anchor': 'middle', class: 'chartPct' });
    pctText.textContent = `${fmt(allocated)}%`;
    const labelText = svgEl('text', { x: 60, y: 74, 'text-anchor': 'middle', class: 'chartLabel' });
    labelText.textContent = 'allocated';
    svg.appendChild(pctText);
    svg.appendChild(labelText);
    chart.appendChild(svg);

    if (Object.keys(assignments).length === 0) {
        legend.appendChild(el('div', 'emptyHint', 'No categories yet. Add one to start weighting your grade.'));
        return;
    }

    for (const [name, obj] of Object.entries(assignments)) {
        const chip = el('button', 'legendChip' + (name === activeCategory ? ' active' : ''));
        chip.type = 'button';
        const dot = el('span', 'dot');
        dot.style.background = colorVar(obj.colorIndex);
        chip.appendChild(dot);
        chip.appendChild(el('span', 'legendName', name));
        chip.appendChild(el('span', 'legendWeight', `${fmt(obj.weight)}%`));
        chip.addEventListener('click', () => setActiveCategory(name));
        legend.appendChild(chip);
    }
    if (allocated < 100) {
        const rest = el('div', 'legendChip static');
        const dot = el('span', 'dot');
        dot.style.background = '#e3e5e8';
        rest.appendChild(dot);
        rest.appendChild(el('span', 'legendName', 'Unallocated'));
        rest.appendChild(el('span', 'legendWeight', `${fmt(100 - allocated)}%`));
        legend.appendChild(rest);
    }
}

// Draws each category as a collapsible card listing its non-deleted assignments.
function renderCategories()
{
    const container = document.getElementById('categories');
    container.textContent = '';

    for (const [name, obj] of Object.entries(assignments)) {
        const isOpen = expandedCategories.has(name);
        const card = el('div', 'category'
            + (isOpen ? ' open' : '')
            + (name === activeCategory ? ' active' : ''));
        card.style.setProperty('--cat-color', colorVar(obj.colorIndex));

        // Clicking the header selects the category; only the arrow opens/closes it.
        const header = el('div', 'categoryHeader');
        const toggleBtn = el('button', 'chevronBtn');
        toggleBtn.type = 'button';
        toggleBtn.title = isOpen ? 'Hide assignments' : 'Show assignments';
        toggleBtn.setAttribute('aria-expanded', String(isOpen));
        toggleBtn.appendChild(iconSvg('arrow', 'chevron'));
        toggleBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (expandedCategories.has(name)) expandedCategories.delete(name);
            else expandedCategories.add(name);
            render();
        });
        header.appendChild(toggleBtn);
        header.appendChild(el('span', 'catName', name));
        header.appendChild(el('span', 'catWeight', `${fmt(obj.weight)}%`));

        const stats = categoryStats(name);
        const statsNode = el('span', 'catStats');
        const avgNode = el('span', 'catAvg', stats.avg === null ? 'avg --' : `avg ${stats.avg.toFixed(0)}%`);
        avgNode.dataset.cat = name;
        statsNode.appendChild(avgNode);
        statsNode.appendChild(document.createTextNode(` · ${stats.count} item${stats.count === 1 ? '' : 's'}`));
        header.appendChild(statsNode);

        const removeBtn = el('button', 'catRemove');
        removeBtn.type = 'button';
        removeBtn.title = 'Remove category';
        removeBtn.appendChild(iconSvg('x'));
        removeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeCategory(name);
        });
        header.appendChild(removeBtn);

        header.addEventListener('click', () => setActiveCategory(name));
        card.appendChild(header);

        const body = el('div', 'categoryBody');
        const keys = rowOrder.filter(key => activeKeys(name).includes(key));
        if (keys.length === 0) {
            body.appendChild(el('div', 'emptyHint', 'Nothing here yet. Click assignments below to add them.'));
        } else {
            const list = el('div', 'rowList');
            keys.forEach(key => list.appendChild(buildRow(key, 'category')));
            body.appendChild(list);
        }
        card.appendChild(body);
        container.appendChild(card);
    }
}

// Draws the assignments that have no category under a sticky "Unassigned (n)" header.
function renderUnassigned()
{
    const header = document.getElementById('unassignedHeader');
    const list = document.getElementById('unassignedList');
    header.textContent = '';
    list.textContent = '';

    const keys = rowOrder.filter(key => !deletedAssignments.has(key) && categoryOf(key) === null);
    header.appendChild(el('span', 'sectionTitle', `Unassigned (${keys.length})`));

    if (Object.keys(assignments).length === 0) {
        header.appendChild(el('span', 'hint', 'Create a category first'));
    }

    if (keys.length === 0) {
        list.appendChild(el('div', 'emptyHint', rowOrder.length === 0
            ? 'No assignments found. Open a Brightspace grades page or add one manually.'
            : 'Every assignment has a category.'));
        return;
    }
    keys.forEach(key => list.appendChild(buildRow(key, 'unassigned')));
}

// Draws the collapsible list of deleted assignments (hidden when there are none).
function renderDeleted()
{
    const section = document.getElementById('deletedSection');
    const header = document.getElementById('deletedHeader');
    const list = document.getElementById('deletedList');
    header.textContent = '';
    list.textContent = '';

    const keys = rowOrder.filter(key => deletedAssignments.has(key));
    section.hidden = keys.length === 0;
    if (keys.length === 0) return;

    header.appendChild(el('span', 'sectionTitle', `Deleted (${keys.length})`));
    header.appendChild(iconSvg('arrow', 'chevron' + (deletedOpen ? ' openChevron' : '')));
    list.hidden = !deletedOpen;
    keys.forEach(key => list.appendChild(buildRow(key, 'deleted')));
}

// One assignment card. mode: 'category' | 'unassigned' | 'deleted'
function buildRow(key, mode)
{
    const info = rowData[key];
    const isDeleted = mode === 'deleted';
    const row = el('div', 'assignmentRow' + (isDeleted ? ' deleted' : ' clickable'));
    row.dataset.key = key;

    const cornerBtn = el('button', 'cornerBtn' + (isDeleted ? ' restore' : ''));
    cornerBtn.appendChild(iconSvg(isDeleted ? 'plus' : 'x'));
    cornerBtn.type = 'button';
    // What the corner button does depends on where the assignment is and who created it.
    if (isDeleted) cornerBtn.title = 'Restore assignment';
    else if (info.manual) cornerBtn.title = 'Delete assignment permanently';
    else if (mode === 'category') cornerBtn.title = 'Remove from category';
    else cornerBtn.title = 'Delete assignment';
    cornerBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (isDeleted) toggleDeleted(key);
        else if (info.manual) deleteManualAssignment(key);
        else if (mode === 'category') unassignKey(key);
        else toggleDeleted(key);
    });
    row.appendChild(cornerBtn);

    row.appendChild(el('div', 'rowTitle', key));

    const score = el('div', 'rowScore');
    if (info.kind === 'text') {
        score.classList.add('muted');
        score.textContent = info.text;
    } else {
        const input = el('input');
        input.type = 'number';
        input.min = '0';
        input.max = String(info.total);
        input.value = info.earned;
        input.disabled = isDeleted;
        score.appendChild(input);
        if (info.kind === 'points') score.appendChild(document.createTextNode(` / ${info.total} `));

        const pctSpan = el('span', 'pct', `(${percentOf(info).toFixed(2)}%)`);
        score.appendChild(pctSpan);

        input.addEventListener('input', () => {
            info.earned = round2(Math.min(MAX_POINTS, Math.max(0, parseFloat(input.value) || 0)));
            const pct = percentOf(info);
            pctSpan.textContent = `(${pct.toFixed(2)}%)`;
            allAssignments[key] = pct;
            refreshStats();
            persistScore(key).catch(err => console.error('Failed to save score:', err));
        });
    }
    row.appendChild(score);

    if (!isDeleted) {
        row.addEventListener('click', (event) => handleRowClick(event, key, mode));
    }
    return row;
}

// ---------- actions ----------

// Clicking a row inside a category sends it back to Unassigned. Clicking an unassigned row adds it to the
// active category; shift-click adds every unassigned row between the previous click and this one.
async function handleRowClick(event, key, mode)
{
    if (event.target.closest('input, button')) return;

    if (mode === 'category') {
        await unassignKey(key);
        return;
    }

    if (!activeCategory) return;
    let keys = [key];
    if (event.shiftKey && lastClickedKey && lastClickedKey !== key) {
        const a = rowOrder.indexOf(lastClickedKey);
        const b = rowOrder.indexOf(key);
        if (a !== -1 && b !== -1) {
            keys = rowOrder
                .slice(Math.min(a, b), Math.max(a, b) + 1)
                .filter(k => !deletedAssignments.has(k) && categoryOf(k) === null);
        }
    }
    assignKeys(keys, activeCategory);
    lastClickedKey = key;

    render();
    await saveGlobalState();
}

// Takes an assignment out of its category and puts it back in Unassigned.
async function unassignKey(key)
{
    const name = categoryOf(key);
    if (name) assignments[name].assignmentsList.delete(key);
    lastClickedKey = null;
    render();
    await saveGlobalState();
}

// Permanently removes an assignment the user created: from storage, its category and the deleted list.
async function deleteManualAssignment(key)
{
    const name = await getCourseKey();
    delete rowData[key];
    rowOrder = rowOrder.filter(k => k !== key);
    delete allAssignments[key];
    Object.values(assignments).forEach(a => a.assignmentsList.delete(key));
    deletedAssignments.delete(key);
    if (lastClickedKey === key) lastClickedKey = null;
    render();

    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    if (manual[name]) {
        delete manual[name][key];
        await chrome.storage.local.set({ _manualAssignments: manual });
    }
    await saveGlobalState();
}

// Greys out an assignment (excluding it from the grade) or restores it. Its data is kept.
async function toggleDeleted(key)
{
    if (deletedAssignments.has(key)) deletedAssignments.delete(key);
    else deletedAssignments.add(key);
    render();
    await saveDeleted();
}

// Deletes a category after confirming; its assignments go back to Unassigned.
async function removeCategory(name)
{
    if (!confirm(`Remove "${name}"? Its assignments will go back to Unassigned.`)) return;
    delete assignments[name];
    expandedCategories.delete(name);
    if (activeCategory === name) activeCategory = Object.keys(assignments)[0] || null;
    render();
    await saveGlobalState();
}

// Scrolls the popup to the Unassigned section, if anything is still unassigned.
function scrollToUnassigned()
{
    const hasUnassigned = rowOrder.some(key => !deletedAssignments.has(key) && categoryOf(key) === null);
    if (!hasUnassigned) return;
    document.getElementById('unassignedSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Shows how much weight is still available in the New Category dialog.
function updateWeightRemaining()
{
    const remaining = Math.max(0, 100 - totalWeight());
    document.getElementById('weightRemaining').textContent = `${fmt(remaining)}% of the grade is still unallocated`;
}

// Wires up the category controls: the New Category dialog (with its validation and limits),
// the "Clear categories" button and the Deleted section toggle.
function createAssignmentType()
{
    const modalOverlay = document.getElementById('typeModalOverlay');
    const typeInput = document.getElementById('assignmentTypeModal');
    const weightInput = document.getElementById('assignmentWeightModal');
    const submitBtn = document.getElementById('submitAssignmentType');
    const cancelBtn = document.getElementById('cancelAssignmentType');

    document.getElementById('createAssignmentType').addEventListener('click', () => {
        if (totalWeight() >= 100) {
            alert('All 100% of the weight is already allocated.');
            return;
        }
        typeInput.value = '';
        weightInput.value = '';
        updateWeightRemaining();
        modalOverlay.style.display = 'flex';
        typeInput.focus();
    });

    submitBtn.addEventListener('click', async () => {
        const assignmentType = typeInput.value.trim();
        const weight = round2(parseFloat(weightInput.value));
        if (!assignmentType || Number.isNaN(weight) || weight <= 0) {
            alert('Please enter a valid category name and weight.');
            return;
        }
        if (assignmentType.length > MAX_CATEGORY_NAME_LENGTH) {
            alert(`Category names can be at most ${MAX_CATEGORY_NAME_LENGTH} characters.`);
            return;
        }
        if (Object.keys(assignments).length >= MAX_CATEGORIES) {
            alert(`You can have at most ${MAX_CATEGORIES} categories.`);
            return;
        }
        if (totalWeight() + weight > 100 + 1e-9) {
            alert('Total weight cannot exceed 100%.');
            return;
        }
        if (Object.prototype.hasOwnProperty.call(assignments, assignmentType)) {
            alert('That category already exists.');
            return;
        }

        assignments[assignmentType] = {
            weight,
            colorIndex: nextColorIndex(),
            assignmentsList: new Set()
        };
        activeCategory = assignmentType;
        modalOverlay.style.display = 'none';
        render();
        // Jump to the assignments that still need a category.
        scrollToUnassigned();
        await saveGlobalState();
    });

    cancelBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
    });

    modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });

    document.getElementById('clearStorage').addEventListener('click', async () => {
        assignments = {};
        activeCategory = null;
        expandedCategories.clear();
        lastClickedKey = null;
        render();
        await saveGlobalState();
    });

    document.getElementById('deletedHeader').addEventListener('click', () => {
        deletedOpen = !deletedOpen;
        renderDeleted();
    });
}

// After confirming, restores the popup to what Brightspace shows: drops manual assignments,
// score edits, categories and deleted assignments.
async function resetToPageData()
{
    if (!confirm('This will delete all manually added assignments, categories and deleted assignments, and restore any scores you changed. Are you sure?')) return;

    const name = await getCourseKey();

    const data = await chrome.storage.local.get('_manualAssignments');
    const manual = data._manualAssignments || {};
    delete manual[name];
    await chrome.storage.local.set({ _manualAssignments: manual });

    // Drop every score edit so assignments show the values from Brightspace again.
    scoreEdits = {};
    await saveScoreEdits();

    assignments = {};
    deletedAssignments = new Set();
    activeCategory = null;
    expandedCategories.clear();
    lastClickedKey = null;
    await saveGlobalState();

    await loadData();
}

// Wires up the New Assignment dialog: validates the name/points limits and adds the result
// as a manual assignment.
function makeAssignment()
{
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('newAssignment').addEventListener('click', () => {
        document.getElementById('newAssignmentName').value = '';
        document.getElementById('newAssignmentTotal').value = '';
        document.getElementById('newAssignmentEarned').value = '';
        overlay.style.display = 'flex';
    });
    document.getElementById('cancelAssignment').addEventListener('click', () => {
        overlay.style.display = 'none';
    });
    document.getElementById('submitAssignment').addEventListener('click', async () => {
        const name = document.getElementById('newAssignmentName').value.trim();
        const total = round2(parseFloat(document.getElementById('newAssignmentTotal').value));
        const earned = round2(parseFloat(document.getElementById('newAssignmentEarned').value));
        if (!name || Number.isNaN(total) || Number.isNaN(earned)) {
            alert('Please enter valid assignment details.');
            return;
        }
        if (name.length > MAX_ASSIGNMENT_NAME_LENGTH) {
            alert(`Assignment names can be at most ${MAX_ASSIGNMENT_NAME_LENGTH} characters.`);
            return;
        }
        if (total <= 0 || total > MAX_POINTS) {
            alert(`Total points must be greater than 0 and at most ${MAX_POINTS.toLocaleString()}.`);
            return;
        }
        if (earned < 0 || earned > total) {
            alert('Earned points must be between 0 and the total points.');
            return;
        }
        if (Object.values(rowData).filter(r => r.manual).length >= MAX_MANUAL_ASSIGNMENTS) {
            alert(`You can add at most ${MAX_MANUAL_ASSIGNMENTS} assignments per course.`);
            return;
        }
        if (name in rowData || SPECIAL_KEYS.includes(name)) {
            alert('An assignment with that name already exists.');
            return;
        }
        const courseKey = await getCourseKey();
        await saveManualAssignments(courseKey, name, earned, total);
        addRow(name, [`${earned}/${total}`], true);
        overlay.style.display = 'none';
        render();
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });
}

// Entry point: runs the semester cleanup, wires up the dialogs, then loads and renders the data.
async function init()
{
    await checkAndClearOldData();
    createAssignmentType();
    makeAssignment();
    await loadData();
}
init();

document.getElementById('resetToPage').addEventListener('click', resetToPageData);
