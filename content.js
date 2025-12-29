

function getElementGrabber()
{
    const container = document.querySelector('.d2l-table')
    let course = {'assignments': [], 'grades': []};
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
            course.assignments.push(titlesText);
            course.grades.push(elementText);
        }
        for(const row of course.grades)
        {
            for(const col of course.assignments)
            {
                console.log(col + ': ' + row);
                continue;
            }
            continue;
        }
        // console.log(JSON.stringify(course));
        return course;
    }
    
    return [];
}
getElementGrabber();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getElement') {
        const result = getElementGrabber();
        sendResponse({result: result});
    }
});
