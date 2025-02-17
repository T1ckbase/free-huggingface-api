// https://bot.sannysoft.com
// https://www.browserscan.net/bot-detection
// https://fingerprintjs.github.io/BotD/main/


// Webdriver
const defaultGetter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver').get;
Object.defineProperty(Navigator.prototype, 'webdriver', {
  set: undefined,
  enumerable: true,
  configurable: true,
  get: new Proxy(defaultGetter, {
    apply: (target, thisArg, args) => {
      // emulate getter call validation
      Reflect.apply(target, thisArg, args);
      return false;
    }
  })
});

// CDP
console.debug = () => { };
