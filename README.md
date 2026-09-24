# Course Passable? 🎓

A Chrome extension for Purdue University students that automatically reads your Brightspace gradebook and lets you calculate your real weighted course grade.

## Features

- Automatically pulls assignment scores from Brightspace
- Create weighted grade categories (Homework, Exams, Labs, etc.) and see them on a pie chart, including how much of the grade is still unallocated
- Each category is a dropdown that lists the assignments inside it, with its average and item count
- After you create a category, the popup jumps to the assignments that still need one
- Your grade updates live as you change scores, categories or weights
- Weights that don't add up to 100% still work: the categories you have are rescaled to make up the whole grade (50% + 25% is graded as 50/75 and 25/75)
- Edit any score to see a "what if" grade, then reset back to the real scores
- Delete an assignment to grey it out and exclude it from your grade, and restore it any time
- Add hypothetical assignments to see how future grades affect your final score
- Saves your setup per course so you never have to redo it
- Syncs grade categories across devices via Google account
- Manually added assignments are preserved when Brightspace updates
- Extension icon only appears on Brightspace grade pages
- Automatic data cleanup at the start and end of each semester

## Installation

### From Source
1. Clone the repository
```bash
   git clone https://github.com/mallenikhil/BrightSpaceDisp.git
```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer Mode** in the top right corner
4. Click **Load unpacked**
5. Select the cloned repository folder

After pulling new changes, click the reload icon on the extension's card in `chrome://extensions/`.

### From Chrome Web Store
> Coming soon

## Usage

1. Navigate to your Brightspace grades page at `purdue.brightspace.com/d2l/lms/grades/`
2. Click the **Course Passable?** icon in your Chrome toolbar
3. Click **+ New category** and enter a name and weight percentage. The pie chart shows how much of the grade is allocated
   - Example: `Homework` → `20%`, `Midterm` → `30%`, `Final` → `50%`
4. The popup scrolls to your **Unassigned** assignments. Click a row to add it to the selected category (shift-click selects a range). Use the **Add to** dropdown to switch categories, and expand a category to see what's inside it. Click an assignment inside a category to send it back to Unassigned
5. Your current grade updates automatically. The note under it shows how much of the course weight it is based on
6. Change any score to try out a "what if" grade
7. Use the red **×** in the top-left corner of an assignment to delete it. It's greyed out in the **Deleted** section (and ignored in your grade) until you restore it with **↺**
8. Use **+ New Assignment** (top of the popup) to add hypothetical future assignments
9. Changes save automatically. Click **Reset to Page Data** (next to New Assignment) to restore the scores from Brightspace and clear categories, deleted assignments and added assignments

### Input limits

To keep the extension's storage small:

| Item | Limit |
|---|---|
| Assignment name | 40 characters |
| Points (total and earned) | Up to 100,000, earned can't exceed total, 2 decimal places |
| Added assignments | 100 per course |
| Category name | 25 characters |
| Categories | 20 per course, weights can't total more than 100% |

## How It Works

The extension uses a content script that runs exclusively on Brightspace grade pages. It reads your assignment data from the gradebook table and stores it locally. The popup lets you organize assignments into weighted categories and calculates your grade based on those weights.

Only categories that contain at least one scored assignment count towards the grade. Their weights are rescaled so they add up to 100%, and each category's score is the average of its (non-deleted) assignments.

Score edits are stored separately from the values scraped from Brightspace, so **Reset to Page Data** can always restore the originals. If Brightspace later posts a different grade for an assignment you edited, your old edit is dropped.

```
manifest.json  → Extension configuration, permissions and content script match rules
content.js     → Scrapes grade data from Brightspace and saves to chrome.storage.local
popup.html     → Layout of the popup
popup.js       → Popup logic: categories, pie chart, assignment lists, grade calculation
style.css      → Popup styling
background.js  → Controls when the extension icon is active
```

## Data & Privacy

- Scraped grades, deleted assignments, score edits and manually added assignments are stored locally on your device via `chrome.storage.local`
- Grade categories (names, weights, and which assignments they contain) sync across your devices via `chrome.storage.sync`
- No data is ever sent to any external server
- Data is automatically cleared at semester boundaries to keep storage clean

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Saves assignment data locally and syncs category weights across devices |
| `activeTab` | Accesses the current tab title to key data per course |
| `declarativeContent` | Only enables the extension icon on Brightspace grade pages |
| `host_permissions` | Allows the content script to read grade data from Brightspace |

## Semester Reset Dates

Data is automatically cleared on the following dates to prevent storage buildup:

| Date | Event |
|---|---|
| January 4 | Spring semester start |
| May 20 | Spring semester end |
| August 18 | Fall semester start |
| December 2 | Fall semester end |

## Requirements

- Google Chrome
- Purdue University Brightspace account
- Active enrollment at Purdue University

## Contributing

Pull requests are welcome. For major changes please open an issue first to discuss what you would like to change.

## Disclaimer

This extension is not affiliated with or endorsed by Purdue University or D2L Brightspace. It is an independent student tool built to enhance the grade viewing experience.
