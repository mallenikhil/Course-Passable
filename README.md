# Course Passable? 🎓

A Chrome extension for Purdue University students that automatically reads your Brightspace gradebook and lets you calculate your real weighted course grade.

## Features

- Automatically pulls assignment scores from Brightspace
- Create weighted grade categories (Homework, Exams, Labs, etc.)
- Add hypothetical assignments to see how future grades affect your final score
- Calculate your current weighted grade instantly
- Saves category setup per course so you never have to redo it
- Syncs grade categories across devices via Google account
- Manually added assignments are preserved when Brightspace updates
- Extension icon only appears on Brightspace grade pages
- Automatic data cleanup at the start and end of each semester

## Installation

### From Source
1. Clone the repository
```bash
   git clone https://github.com/yourusername/course-passable.git
```
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer Mode** in the top right corner
4. Click **Load unpacked**
5. Select the cloned repository folder

### From Chrome Web Store
> Coming soon

## Usage

1. Navigate to your Brightspace grades page at `purdue.brightspace.com/d2l/lms/grades/`
2. Click the **Course Passable?** icon in your Chrome toolbar
3. Create grade categories by entering a name and weight percentage; the pie chart shows how much of the grade is allocated
   - Example: `Homework` → `20%`, `Midterm` → `30%`, `Final` → `50%`
4. After creating a category the popup scrolls to your unassigned assignments. Click a row to add it to the selected category (shift-click selects a range). Expand a category to see what's inside it
5. Your current grade updates automatically. If your weights don't add up to 100% (say 50% + 25%), they are rescaled so the categories you have make up 100% of the grade
6. Use the red **×** in the top-left corner of an assignment to delete it. It's greyed out (and ignored in your grade) until you restore it with **↺**
7. Use **New Assignment** (top of the popup) to add hypothetical future assignments (names up to 40 characters, points up to 100,000, up to 100 per course)
8. Changes save automatically. Click **Reset to Page Data** (next to New Assignment) to restore the scores from Brightspace and clear categories, deleted and added assignments

## How It Works

The extension uses a content script that runs exclusively on Brightspace grade pages. It reads your assignment data from the gradebook table and stores it locally. The popup lets you organize assignments into weighted categories and calculate your grade based on those weights.
```
content.js     → Scrapes grade data from Brightspace and saves to chrome.storage.local
popup.js       → UI for organizing assignments and calculating grades
background.js  → Controls when the extension icon is active
```

## Data & Privacy

- All data is stored locally on your device via `chrome.storage.local`
- Grade category weights sync across your devices via `chrome.storage.sync`
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
