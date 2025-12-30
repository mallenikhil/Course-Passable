

function getElementGrabber()
{
    const container = document.querySelector('.d2l-table')
    let course = {};
    if(container)
    {
            
        const rows = container.querySelectorAll('tr');
        const rowArray = Array.from(rows);
        for(const row of rowArray)
        {
            const titles = row.querySelectorAll('label');
            const element = row.querySelectorAll('span');
            const titlesText = Array.from(titles).map(title => title.innerText);
            const elementText = Array.from(element).map(el => el.innerText);
            course[titlesText[0]] = elementText;
        }
        console.log(JSON.stringify(course));
        return course;
    }
    return course;
}

getElementGrabber();
function toString()
{
    const course = getElementGrabber();
    const map = new Map();
    for(const row of course.grades)
    {
        for(const col of course.assignments)
        {
            map.set(col, row);
            continue;
        }
        continue;
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getElement') {
        const result = getElementGrabber();
        sendResponse({result: result});
    }
});
