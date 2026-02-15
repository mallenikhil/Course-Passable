let types = [];
let assignments = [];
let totalWight = 0;
let count = 1;
function assignmentToForm(item, key) 
{
    let tbodyRef = document.getElementById('assignment').getElementsByTagName('tbody')[0];
    let row = tbodyRef.insertRow(-1);
    let assignmentTitle = row.insertCell(0);
    assignmentTitle.style.c
    assignmentTitle.textContent = key;
    let pointCell = row.insertCell(1);
    if(item[0].includes("/"))
    {
        const [earned, total] = item[0].split("/").map(Number);
        let input = document.createElement('input');
        input.type = 'number';
        input.min = "0";
        input.max = total;
        input.value = earned;
        pointCell.appendChild(input);
        pointCell.appendChild(document.createTextNode(` / ${total}`));
    }
    else 
    {
        pointCell.textContent = item[0];
    }
}
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
                    
                    assignmentToForm(courseData[key], key);
                    
                }
            }
        }
        
        
    }
    catch (error) 
    {
        console.error("Error retrieving stored data:", error);
    }
}

function createAssignmentType()
{
    let buttonPress = document.getElementById('createAssignmentType');
    buttonPress.addEventListener('click', async () => {
        let assignmentType = document.getElementById('assignmentType').value;
        let weight = document.getElementById('weight').value;
        if(assignmentType && weight && totalWight + parseFloat(weight) <= 100 && !document.getElementById('types').textContent.includes(assignmentType))
        {
            const parent = document.getElementById('types');
            const newBtn = document.createElement('button');
            newBtn.textContent = assignmentType;
            newBtn.classList.add('assignmentTypeButton');
            newBtn.style.backgroundColor = `var(--color-${count})`;
            parent.appendChild(newBtn);
            totalWight += parseFloat(weight);
            types.push({[assignmentType]: weight});
            count++;
            
        }
    });
    let clearBtn = document.getElementById('clearStorage');
    clearBtn.addEventListener('click', async () => {
        const parent = document.getElementById('types');
        parent.innerHTML = '';
        totalWight = 0;
        count = 1;
    });
}
createAssignmentType();
displayStoredData();

// document.getElementById('getElement').addEventListener('click', getElement);

