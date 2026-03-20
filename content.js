let course = {"courseName": document.title};

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

async function getAllStorageItems()
{
    try {
        const allItems = await chrome.storage.local.get(null);
        console.log("All items in local storage:", allItems);
    } catch (error) {
        console.error("Error retrieving items from local storage:", error);
    }
}

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