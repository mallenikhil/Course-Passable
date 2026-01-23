

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
                
                    
                   
                    document.getElementById('result').textContent += `${key}: ${String(courseData[key]).replace(",", "      ")} \n`;
                    console.log(key + ": " + courseData[key]);
                    document.getElementById('result').textContent += `--------------------------\n\n`;
                }
            }
        }
        
        
    }
    catch (error) 
    {
        console.error("Error retrieving stored data:", error);
    }
}

displayStoredData();

// document.getElementById('getElement').addEventListener('click', getElement);

