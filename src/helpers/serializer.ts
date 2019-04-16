/**
 * Refactored and extracted version of
 * https://github.com/sendpulse/sendpulse-rest-api-node.js/blob/master/api/sendpulse.js
 * */


function _utf8Size(str) {
  let size = 0;
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x0080) {
      size += 1;
    } else if (code < 0x0800) {
      size += 2;
    } else {
      size += 3;
    }
  }
  return size;
}

function _getType(inp): string {
  let type: string = typeof inp;

  if (type === 'object' && !inp) {
    return 'null';
  } else if (type === 'object') {
    if (!inp.constructor) {
      return 'object';
    }
    let cons = inp.constructor.toString();
    let match = cons.match(/(\w+)\(/);
    if (match) {
      cons = match[1].toLowerCase();
    }
    if (cons in ['boolean', 'number', 'string', 'array']) {
      type = cons;
    }
  }
  return type;
}

export default function serialize(mixed_value: any): string {
  let val: string;
  let vals = '';
  let type: string = _getType(mixed_value);

  switch (type) {
    case 'function':
      val = '';
      break;
    case 'boolean':
      val = 'b:' + (mixed_value ? '1' : '0');
      break;
    case 'number':
      val = (Math.round(mixed_value) === mixed_value ? 'i' : 'd') + ':' + mixed_value;
      break;
    case 'string':
      val = 's:' + _utf8Size(mixed_value) + ':"' + mixed_value + '"';
      break;
    case 'array':
    case 'object':
      val = 'a';
      let count = 0;
      for (let key in mixed_value) {
        if (mixed_value.hasOwnProperty(key)) {
          if (_getType(mixed_value[key]) === 'function') {
            continue;
          }
          let okey = (key.match(/^[0-9]+$/) ? parseInt(key, 10) : key);
          vals += serialize(okey) + serialize(mixed_value[key]);
          count++;
        }
      }
      val += ':' + count + ':{' + vals + '}';
      break;
    case 'undefined':
    default:
      val = 'N';
      break;
  }
  if (type !== 'object' && type !== 'array') {
    val += ';';
  }
  return val;
}
