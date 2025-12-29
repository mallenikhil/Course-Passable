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


// document.getElementById('getElement').addEventListener('click', getElement);

