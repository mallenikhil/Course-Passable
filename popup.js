// let output = '';

// async function getElement()
// {
//     const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
//      const response = await chrome.scripting.executeScript({
//       target: { tabId: tab.id },
//       func: () => {
//         const container = document.querySelector('.d2l-table')
//         let course = {'assignments': [], 'grades': []};
//         if(container)
//         {
            
//             const rows = container.querySelectorAll('tr');
//             const rowArray = Array.from(rows);
//             for(const row of rowArray)
//             {
//                 const titles = row.querySelectorAll('label');
//                 const element = row.querySelectorAll('span');
//                 course.assignments.push(titles);
//                 course.grades.push(element);
//             }
//             return course;
//         }
//         return [];
//     }
//     });
//     for(const res of response) {
//         document.getElementById('result').innerText = res.result.join('\n');
//         output = res.result.join('\n\n');
//     }
// }

async function displayStoredData() 
{
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const courseName = tab.title;
    console.log("Course Name:", courseName);
    try 
    {
        let resultText = '';
        const storedData = await chrome.storage.local.get(courseName);
        document.getElementById('result').textContent += `${courseName}:\n`;
        if (storedData[courseName]) 
        {
            const courseData = storedData[courseName];
            resultText = `Course Name: ${courseData.courseName}\n\n`;
            for(const key in courseData)
            {
                if(key !== 'courseName' && key !== 'Order' && key !== "undefined")
                {
                
                    // const val = (courseData[key] && typeof courseData[key] === 'object')
                    //     ? JSON.stringify(courseData[key])
                    //     : String(courseData[key]);
                   
                    document.getElementById('result').textContent += `${key}: ${String(courseData[key]).replace(",", "      ")} \n`;
                    console.log(key + ": " + courseData[key]);
                    document.getElementById('result').textContent += `--------------------------\n\n`;
                }
            }
        }
        // const resultEl = document.getElementById('result');
        // if (resultEl) resultEl.textContent = resultText || 'No data found.';
        
    }
    catch (error) 
    {
        console.error("Error retrieving stored data:", error);
    }
}

displayStoredData();

// document.getElementById('getElement').addEventListener('click', getElement);

