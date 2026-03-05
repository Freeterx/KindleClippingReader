document.getElementById("open-tab-btn").addEventListener("click", function() {
  console.log("reach here");
  chrome.tabs.create({ url: "Kindleclipping.html" });
});
