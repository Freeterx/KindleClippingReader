// Open Kindleclipping.html when the extension icon is clicked
chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: "Kindleclipping.html" });
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('Extension installed');
});

