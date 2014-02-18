// Followr Background.js

// -----------------------
// Backend Logic
// -----------------------

var backend = {},
	loggedIn = true;

// Launch Twitter function
backend.launchTwitterInBackground = function() {
	if (!loggedIn) {
		return;
	}

	// Only run if queries exist
	backend.getSearchQueries(function(searchQueries) {
		if (!searchQueries.length) {
			return;
		}
		// Store run time in milliseconds
		chrome.storage.sync.set({
			'lastRun': (new Date()).getTime()
		});
		backend.incrementRunCount();

		chrome.windows.create({
			url: 'http://twitter.com/?followr=true',
			width: 390,
			height: 240,
			top: 40000,
			left: 40000,
			focused: false,
			type: 'popup'
		});
	});
};

backend.incrementRunCount = function(cb) {
	chrome.storage.sync.get('runCount', function(data) {
		chrome.storage.sync.set({
			runCount: (typeof data.runCount === 'number') ? (data.runCount + 1) : 0
		}, cb);
	});
};

// Backend task to get time last run
backend.getLastRunTime = function(cb) {
	chrome.storage.sync.get('lastRun', function(data) {
		cb(data.lastRun);	
	});
};

// Backend task to return time left before next run
backend.getTimeLeftBeforeRun = function(cb) {
	backend.getLastRunTime(function(lastRunTime) {
		var currentTime = (new Date()).getTime(),
			millisecondsDiff = currentTime - lastRunTime,
			minutesDiff = Math.floor(millsecondsDiff / (1000 * 60));
		cb(minutesDiff);
	});

	return true;
};

backend.getNewTweets = function(data, cb) {
	var i = 0,
		returnTweets = [],
		getNewTweetRecur = function(tweetIter) {
			var tweet = data.tweets[tweetIter];

			if (tweetIter >= data.tweets.length) {
				cb(returnTweets);
			} else {
				(function() {
					var tweetId = tweet;
					chrome.storage.sync.get('tweet-' + tweetId, function(tweetInDb) {
						if (Object.keys(tweetInDb).length === 0) {
							returnTweets.push(tweet);
						}
						getNewTweetRecur(tweetIter + 1);	
					});
				})();
			}
		};

	if (!data.tweets || !data.tweets.length) {
		cb([]);
	}
	getNewTweetRecur(0);

	return true;
};

backend.getSearchQueries = function(cb) {
	chrome.storage.sync.get('searchQueries', function(data) {
		cb(data.searchQueries);
	});

	return true;
};

backend.getMaxQueries = function(cb) {
	chrome.storage.sync.get('maxQueries', function(data) {
		cb(data.maxQueries);
	});

	return true;
};

backend.getLoggedInStatus = function(cb) {
	cb(loggedIn);

	return true;
};

backend.setFavorited = function(data, cb) {
	var storageObj = {};
	storageObj['tweet-' + data.id] = true;
	chrome.storage.sync.set(storageObj);

	return true;
};

backend.setSearchQueries = function(queries, cb) {
	queries = queries || [];
	// TODO: Put an interface to this function
	chrome.storage.sync.set({
		searchQueries: queries
	}, cb);

	return true;
};

backend.setMaxQueries = function(data, cb) {
	// TODO: Put an interface to this function
	chrome.storage.sync.set({
		maxQueries: data
	}, cb);

	return true;
};

backend.setOptions = function(data, cb) {
	var set = 0,
		respondOnceBothDone = function() {
			if (set >= 2) {
				cb(true);
			}	
		};

	backend.setMaxQueries(data.numTweets, function() {
		set++;
		respondOnceBothDone();	
	});
	backend.setSearchQueries(data.queries, function() {
		set++;
		respondOnceBothDone();		
	});	

	return true;
};

backend.setLoggedInStatus = function(data, cb) {
	loggedIn = data;

	return true;
};

// -----------------------
// Run
// -----------------------

// Capture calls from the injection script
chrome.runtime.onMessage.addListener(
	function(data, sender, sendResponse) {
		switch(data.message) {	
			case 'getTimeLeftBeforeRun':
				return backend.getTimeLeftBeforeRun(sendResponse);
			case 'getSearchQueries':
				return backend.getSearchQueries(sendResponse);
			case 'getNewTweets':
				return backend.getNewTweets(data.data, sendResponse);
			case 'getMaxQueries':
				return backend.getMaxQueries(sendResponse);
			case 'getLoggedInStatus':
				return backend.getLoggedInStatus(sendResponse);
			case 'setFavorited':
				return backend.setFavorited(data.data, sendResponse);
			case 'setSearchQueries':
				return backend.setSearchQueries(data.data, sendResponse);
			case 'setMaxQueries':
				return backend.setMaxQueries(data.data, sendResponse);
			case 'setOptions':
				return backend.setOptions(data.data, sendResponse);
			case 'setLoggedInStatus':
				return backend.setLoggedInStatus(data.data, sendResponse);
			case 'forceRun':
				backend.launchTwitterInBackground();
				return true;
			default:
				return false;
		}
	}
);

// First time run
chrome.storage.sync.get(undefined, function(data) {
	var optionsUrl;

	if (data.hasSetup !== true) {
		optionsUrl = chrome.extension.getURL('options.html');
		chrome.tabs.query({ url: optionsUrl }, function(tabs) {
			if (tabs.length) {
				chrome.tabs.update(tabs[0].id, { active: true });
			} else {
				chrome.tabs.create({ url: optionsUrl });
			}
		});
	} else {
		backend.launchTwitterInBackground();
	}

	chrome.storage.sync.set({
		hasSetup: true
	});
});

// Favorite query every 30 minutes
setInterval(backend.launchTwitterInBackground, 1000 * 60 * 30);