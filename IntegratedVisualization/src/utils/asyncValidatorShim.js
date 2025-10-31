// Minimal shim for 'async-validator' to avoid Node/process usage in browser.
class AsyncValidator {
  constructor(schema) {
    this.schema = schema;
  }
  validate(source, options, callback) {
    if (typeof options === 'function') {
      callback = options;
    }
    if (callback) callback();
    return Promise.resolve();
  }
}
export default AsyncValidator;