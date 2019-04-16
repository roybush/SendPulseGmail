// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue';

import App from './components/App.vue';
import './assets/stylesheets/main.sass';

Vue.config.productionTip = false;

(function () {
  const container = document.createElement('div');
  container.className = 'J-J5-Ji';
  let prevHolder;
  (function () {
    const appDiv = document.createElement('div');
    container.appendChild(appDiv);
    new Vue({
      el: appDiv,
      render: h => h(App),
    });
  })();
  function areAllParentsVisible(el) {
    let visible = true;
    while (el) {
      if (window.getComputedStyle(el).display === 'none') {
        visible = false;
      }
      el = el.parentElement;
    }
    return visible;
  }
  function onGmailLoad() {
    const holders = document.querySelectorAll('.G-tF');
    let holder;
    for (let i = 0; i < holders.length; i++) {
      if (areAllParentsVisible(holders[i])) {
        holder = holders[i];
        break;
      }
    }
    if (holder && prevHolder !== holder) { // if holder changed
      if (prevHolder) {
        prevHolder.removeChild(container);
      }
      prevHolder = holder;
      holder.appendChild(container);
      console.log('SP set position to holder');
    }
  }
  setInterval(onGmailLoad, 400);
  onGmailLoad();
})();

