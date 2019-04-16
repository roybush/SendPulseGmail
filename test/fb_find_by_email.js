var request = require('request');
let viewer = '100009309661409';
let cookiesMap = {
  "c_user": viewer,
  "xs": "49%3AHQVC2p9j8JC6Ag%3A2%3A1501775168%3A-1%3A-1",

};

let queryParams = {
  'dpr': '1.5',
  'value': 'lagif@mail.ru',
  'viewer': viewer,
  '__a': '1',
  '__dyn': '',
};



let cookies = Object.keys(cookiesMap).map(r => `${r}=${cookiesMap[r]}`).join('; ');
let headers = {
  'Origin':'https://mail.google.com',
  'Referer':'https://mail.google.com/mail/u/0/',
  'cookie': cookies,
  'user-agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/59.0.3063.4 Safari/537.36',

}
function _urlEncode(obj) {
  let str = [];
  for (let p in obj)
    if (obj.hasOwnProperty(p)) {
      str.push(`${encodeURIComponent(p)}=${encodeURIComponent(obj[p])}`);
    }
  return str.join("&");
};
_urlEncode(queryParams);

let url = `https://www.facebook.com/ajax/typeahead/search.php?${_urlEncode(queryParams)}`;


request.get(url, {headers}, function (err, res, body) {
  if (err || res.statusCode !== 200) {
    console.error(err);
  } else {
    console.log(res.body);
  }
});

