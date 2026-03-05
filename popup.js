
let assignments = {};
let allAssignments = {};
let totalWight = 0;
let count = 1;


function assignmentToForm(item, key) 
{
    let tbodyRef = document.getElementById('assignment').getElementsByTagName('tbody')[0];
    let row = tbodyRef.insertRow(-1);
    let assignmentTitle = row.insertCell(0);
    assignmentTitle.classList.add('clickableAssignment');
    assignmentTitle.addEventListener('click', () => {
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
    });
    
    
    assignmentTitle.textContent = key;
    let pointCell = row.insertCell(1);
    let t = item[0]
    if(t.includes("/"))
    {
        const [earned, total] = t.split("/").map(Number);
        let input = document.createElement('input');
        input.type = 'number';
        input.min = "0";
        input.max = total;
        input.value = earned;
        pointCell.appendChild(input);
        pointCell.appendChild(document.createTextNode(` / ${total}`));
        let percentageSpan = document.createElement('span');
        const initialPct = ((earned / total) * 100);
        percentageSpan.textContent = `(${initialPct.toFixed(2)}%)`;
        allAssignments[key] = parseFloat(initialPct.toFixed(2));
        input.addEventListener('input', () => {
            const value = parseFloat(input.value) || 0;
            let pct = (value / total) * 100;
            if (pct > 100) pct = 100;
            percentageSpan.textContent = `(${pct.toFixed(2)}%)`;
            allAssignments[key] = parseFloat(pct.toFixed(2));
        });
        pointCell.appendChild(percentageSpan);
        let deleteBtn = document.createElement('button');
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener('click', () => {
            pointCell.parentElement.remove();
            delete allAssignments[key];
        });
        pointCell.appendChild(deleteBtn);
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
                    let [earned, total] = courseData[key][0].split("/").map(Number);
                    allAssignments[key] = parseFloat((earned / total * 100).toFixed(2));
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
            assignments[assignmentType] = {
                weight: parseFloat(weight),
                assignmentsList: new Set()
            };
            count++;
            
        }
    });
    let clearBtn = document.getElementById('clearStorage');
    clearBtn.addEventListener('click', async () => {
        const parent = document.getElementById('types');
        parent.innerHTML = '';
        totalWight = 0;
        count = 1;
        assignments = {};
    
        // Reset all assignment cell colors
        document.querySelectorAll('.clickableAssignment').forEach(cell => {
            cell.style.backgroundColor = 'transparent';
            cell.dataset.disabled = 'false';
            cell.dataset.savedCategory = '';
            cell.dataset.savedValue = '';
        });
    });
}

function calculateGrade()
{
  let weightedTotal = 0;
  let usedWeight = 0;

  for (const [typeName, typeObj] of Object.entries(assignments)) {
    if (!typeObj || typeof typeObj !== "object") continue;
    if (!(typeObj.assignmentsList instanceof Set)) continue;
    if (typeof typeObj.weight !== "number") continue;

    const scores = [];
    for (const aKey of typeObj.assignmentsList) {
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

  const finalPercent = usedWeight > 0
    ? (weightedTotal * (100 / usedWeight))
    : 0;

  const gradeElement = document.getElementById("finalGrade");
  gradeElement.textContent = `Current Grade: ${finalPercent.toFixed(2)}%`;

  return finalPercent;
}
createAssignmentType();
displayStoredData();
document.getElementById('types').addEventListener('click', (event) => {
        const x = event.target.closest('.assignmentTypeButton');
        if(!x) return;
        document.querySelectorAll('.assignmentTypeButton').forEach(b => b.classList.remove('active'));
        x.classList.add('active');
});

document.getElementById("calcGrade").addEventListener("click", calculateGrade);


