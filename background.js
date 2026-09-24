// On install: disable the toolbar icon everywhere, then enable it only on
// purdue.brightspace.com/d2l/lms/grades/ pages.
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();

  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {

            hostEquals: 'purdue.brightspace.com',
            pathPrefix: '/d2l/lms/grades/'
          }
        })
      ],
      actions: [new chrome.declarativeContent.ShowAction()]
    }]);
  });
});
