chrome.runtime.onMessage.addListener(
  function (request, sender, sendResponse) {
    if (request.facebook_c_user) {
      window['chrome'].cookies.get({url: 'https://www.facebook.com/', name: 'c_user'},
        cookie => {
          if (cookie) {
            sendResponse(cookie.value);
          } else {
            sendResponse();
          }
        });
      return true;
    }
  });

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.create({ url: 'https://mail.google.com/' });
});
