//Storage of all course data
let course = {"courseName": document.title};
function getElementGrabber()
{
    const container = document.querySelector('.d2l-table')
    course = {"courseName": document.title};
    if(container)
    {

        const tbody = container.querySelector('tbody');
        const first = tbody.querySelector('tr');
        // console.log(first);
        
        const ths = Array.from(first.querySelectorAll('th')).map(th => th.innerText.trim());
        course['Order'] = ths;
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
        
        if(chrome.storage.local.get(course).courseName === document.title)
        {
            chrome.storage.local.remove('courseData');
        }
        storeCourse(course);
        console.log(course);
        return course;
    }
    return course;
}

  
function storeCourse(courseData)
{
    chrome.storage.local.set({[courseData.courseName]: courseData}, function() {
        console.log('Course data stored successfully.');
    });
}

async function getAllStorageItems() {
  try {
    const allItems = await chrome.storage.local.get(null);
    console.log("All items in local storage:", allItems);
  } catch (error) {
    console.error("Error retrieving items from local storage:", error);
  }
}

//Access the elements and change the data for calculation

function acccessElements(data)
{
    let arr = data.Order;
    let index;
    for(let i = 0; i < arr.length; i++)
    {
        if(arr[i] === "Grade")
        {
            index = i;
            break;
        }
    }  
    index = index - 1;
          
    

}

getElementGrabber();
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getElement') {
        const result = getElementGrabber();
        sendResponse({result: result});
    }
});

