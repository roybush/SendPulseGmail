export default class GMailTracker {

  _trackElement: any;
  _growlElement: any;
  _growlText: any;
  _listener: any;

  /*
  get trackElement(): any  {
    return this.querySelector('_trackElement', '.ae4 .F.cf.zt');
  }
  */

  querySelector(elName: string, selector: string) {
    if (!this[elName]) {
      this[elName] = document.querySelector(selector);
    }
    if (!this[elName]) {
      throw `Sp No El`;
    }
    return this[elName];
  }

  _isDescendant(parent: any, child: Node) {
    while (child != null) {
      if (child === parent) {
        return true;
      }
      child = child.parentNode;
    }
    return false;
  }


  registerOuterClick(element: any, cb: Function) {
    document.removeEventListener('click', this._listener);
    this._listener = e => {
      if (!this._isDescendant(element, e.target)) {
        document.removeEventListener('click', this._listener);
        cb();
      }
    };
    document.addEventListener('click', this._listener);
  }

  getCheckedEmails(): string[] {
    try {
      // this.trackElement.querySelectorAll('tr.x7 span[email]');
      let nodes = document.querySelectorAll('tr.x7 span[email]');
      console.log(nodes);
      let emails: string[] = Array.prototype.slice.call(nodes)
        .map(e => e.getAttribute('email'));
      return Array.from(new Set(emails)); // remove duplicates
    } catch (e) {
      if (e === 'Sp No El') {
        return [];
      } else {
        throw e;
      }
    }
  }

  get growlHolder(): any {
    return this.querySelector('_growlElement', '.b8.UC');
  }

  get growlText(): any {
    return this.querySelector('_growlText', '.b8.UC .vh');
  }

  showGrowl(text: string) {
    this.growlHolder.style = '';
    this.growlText.textContent = text;
  }

}
