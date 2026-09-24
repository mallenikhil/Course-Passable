let course = {"courseName": document.title};

// Converts a letter grade (A+ ... F) to an approximate percentage string like "95%",
// or null if the text is not a letter grade.
function letterGradeToPercentage(grade)
{
    const gradeMap = {
        'A+': 100,
        'A':  95,
        'A-': 92,
        'B+': 88,
        'B':  85,
        'B-': 82,
        'C+': 78,
        'C':  75,
        'C-': 72,
        'D+': 68,
        'D':  65,
        'D-': 62,
        'F':  50
    };
    const trimmed = grade.trim();
    if (gradeMap[trimmed] !== undefined) {
        return `${gradeMap[trimmed]}%`;
    }
    return null;
}

// Cleans one scraped cell: ignores empty/placeholder values, keeps "x/y" points and percentages,
// and converts letter grades. Returns null if the value is unusable.
function normalizeGradeValue(value)
{
    if (!value || value === 'N/A' || value === '-' || value === '-%') return null;
    if (value.includes('/')) return value;
    if (value.includes('%')) {
        const num = parseFloat(value.replace('%', ''));
        if (!isNaN(num)) return value;
        return null;
    }
    const asLetter = letterGradeToPercentage(value);
    if (asLetter) return asLetter;
    return null;
}

// Scrapes the gradebook table (.d2l-table) into { courseName, Order, <assignment>: [values...] },
// stores it, and returns it.
async function getElementGrabber()
{
    const container = document.querySelector('.d2l-table');
    if (!container) return course;

    course = {"courseName": document.title};

    const tbody = container.querySelector('tbody');
    const first = tbody.querySelector('tr');

    const ths = Array.from(first.querySelectorAll('th')).map(th => th.innerText.trim());
    course['Order'] = ths;

    const rows = container.querySelectorAll('tr');
    for (const row of Array.from(rows))
    {
        const titles = row.querySelectorAll('label');
        const element = row.querySelectorAll('span');
        const titlesText = Array.from(titles).map(title => title.innerText.trim());
        let elementText = Array.from(element).map(el => el.innerText.trim());

        elementText = elementText.filter(el => el !== '');
        elementText = elementText.map(val => {
            const normalized = normalizeGradeValue(val);
            return normalized !== null ? normalized : val;
        });

        if (titlesText[0]) {
            course[titlesText[0]] = elementText;
        }
    }

    await storeCourse(course);
    
    return course;
    
}

// Saves the scraped data to chrome.storage.local keyed by the page title.
// Assignments saved earlier that are missing from this scrape are kept.
async function storeCourse(courseData)
{
    const existing = await chrome.storage.local.get(courseData.courseName);
    const existingCourse = existing[courseData.courseName] || {};

    const merged = {};
    merged['courseName'] = courseData.courseName;
    merged['Order'] = courseData.Order;

    for (const key in courseData) {
        if (key === 'courseName' || key === 'Order') continue;
        merged[key] = courseData[key];
    }

    for (const key in existingCourse) {
        if (key === 'courseName' || key === 'Order') continue;
        if (!(key in merged)) {
            merged[key] = existingCourse[key];
        }
    }

    await chrome.storage.local.set({ [courseData.courseName]: merged });
    console.log('Stored:', Object.keys(merged));
}

// Debug helper: logs everything in local storage. Not called anywhere at the moment.
async function getAllStorageItems()
{
    try {
        const allItems = await chrome.storage.local.get(null);
        console.log("All items in local storage:", allItems);
    } catch (error) {
        console.error("Error retrieving items from local storage:", error);
    }
}

// Averages every percentage found in the scraped data. The result is not used at the moment;
// the popup does its own weighted calculation.
function calculateGrade(data)
{
    let grade = 0;
    let index2 = 0;
    for (const dataKey in data)
    {
        if (!Array.isArray(data[dataKey])) continue;
        for (let j = 0; j < data[dataKey].length; j++)
        {
            const val = data[dataKey][j];
            if (typeof val === 'string' && val.includes('%'))
            {
                const num = parseFloat(val.replace('%', ''));
                if (!isNaN(num))
                {
                    grade += num;
                    index2 += 1;
                }
            }
        }
    }
    grade = index2 > 0 ? grade / index2 : 0;
    return grade;
}

// Unfinished helper: finds the column before "Points" in the table order but does not return or use it.
function getGradeByPoint(data)
{
    let arr = data.Order;
    let index;
    for (let i = 0; i < arr.length; i++)
    {
        if (arr[i] === "Points")
        {
            index = i - 1;
            break;
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
        await getElementGrabber();
        calculateGrade(course);
    });
} else {
    getElementGrabber().then(() => calculateGrade(course));
}