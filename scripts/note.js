// Get page elements
      const noteTitle = document.getElementById('notetitle');
      const locationLabel = document.getElementById('location');
      const category = document.getElementById('category');
      const saveBtn = document.getElementById('save');
	  
      // Add click event listener for the save button
      saveBtn.addEventListener('click', () => {
        const title = noteTitle.value;
        const loc = locationLabel.textContent;
        const cat = category.value;

        // Add save note logic here
		console.log("send note to onenote");
		console.log("page is done. close this window");
		
		// Call the function
//		createOneNotePage();

		
		// Define request parameters
		var requestUrl = "https://graph.microsoft.com/v1.0/me/onenote/sections/92947CE0-351A-495C-B132-CEA54AD9CFE7/pages";
		
		// Define access_token variable
		const access_token = code;

	 // Use template string to concatenate Bearer keyword and access_token variable
		const authHeader = `Bearer ${access_token}`;
		debugger;
		
		var requestHeaders = {
		  "Content-Type": "application/json",
		  "Authorization": authHeader
		};
		
		var requestBody = {
		  "content": pageContent
		};
		console.log("request head:");
		console.log(requestHeaders);
		// Send POST request
		var xhr = new XMLHttpRequest();
		xhr.open("POST", requestUrl, true);
		xhr.setRequestHeader("Content-Type", requestHeaders["Content-Type"]);
		xhr.setRequestHeader("Authorization", requestHeaders.Authorization);
		xhr.onreadystatechange = function() {
		  if (xhr.readyState === 4 && xhr.status === 201) {
			var responseHeaders = xhr.getAllResponseHeaders();
			var responseBody = xhr.responseText;
			// Process the response
			console.log(responseBody);
			console.log(xhr);
		  } else if (xhr.readyState === 4) {
			console.error(xhr.statusText);
			console.log(xhr);
		  }
		};
		xhr.send(JSON.stringify(requestBody));

		// Wait to get the return code to close current window.
		// If there are error messages, show them.
//		window.close();
      });
	  
	  // Define a callback function to handle the operation after returning from the Microsoft auth login page
	function handleAuthCallback(code) {
	  console.log(`Received code parameter: ${code}`);
	  chrome.storage.local.set({ "authToken": code }, function(){
		console.log('Saved to local storage');
		});
	  // Send a message back to save the code
	  // chrome.runtime.sendMessage({
		// type: "auth_code",
		// code: code
		// });
	}

	  // Get the code value from the URL
	const queryString = window.location.search;
	const urlParams = new URLSearchParams(queryString);
	const code = urlParams.get('code');
	var pageContent = '';

	// Execute the following code when the page loads
	window.onload = function () {
	  // If the code value exists, call the callback function and pass the code value to it
	  if (code) {
		handleAuthCallback(code);
	  }
	  // Set initial value for title
	  chrome.storage.local.get(["pageTitle"], function(items){
		noteTitle.value = items.pageTitle;
		console.log('noteTitle.value');
		});
		
		// Set initial value for page content
	  chrome.storage.local.get(["pageContent"], function(items){
		pageContent = items.pageContent;
		console.log(pageContent);
		});
	};