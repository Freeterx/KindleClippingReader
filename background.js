// Open Kindleclipping.html when the extension icon is clicked
chrome.action.onClicked.addListener(function() {
  chrome.tabs.create({ url: "Kindleclipping.html" });
});

chrome.runtime.onInstalled.addListener(function() {
  console.log('Starting extension initialization');
  chrome.storage.local.set({ "authToken": '' }, function() {
    console.log('chrome.storage.local has been initialized');
  });
});

chrome.runtime.onMessage.addListener(function(message) {
	console.log("reach backend.js");
	console.log(message.type);
  if (message.type === "auth_url") {
    console.log("it is here!!!");
	console.log(message);
	let popupWindow = null;
	popupWindow = message.popup;
	if (popupWindow !== null)
	{ popupWindow.location.href = message.url; };
  }
  else if (message.type === "auth_code") {
    // Save the authorization code to chrome.storage
	console.log("code reaches backend.js");
	console.log(message.code);
	sessionStorage.setItem('notecode', message.code);
  }
});
