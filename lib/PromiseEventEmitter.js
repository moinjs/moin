module.exports = class PromiseEventEmitter {
    constructor(thisObj) {
        this._listener = {};
        this._thisObj = thisObj;
    }

    _getListener(name) {
        if (!this._listener.hasOwnProperty(name))return [];
        let listener = this._listener[name].map(li=>li.fnc);
        this._listener[name] = this._listener[name].filter(li=>li.once == false);
        return listener;
    }

    setThisObject(obj) {
        this._thisObj = obj;
    }

    emit(event, ...args) {
        return this._getListener(event).reduce((prev, cur)=> {
            return prev.then((...arg)=> {
                return cur.apply(this._thisObj, args);
            });
        }, Promise.resolve());
    }

    emitParallel(event, ...args) {
        return Promise.all(
            this._getListener(event)
                .map(fnc=>fnc.apply(this._thisObj, args))
        );
    }

    on(event, fnc) {
        if (!this._listener.hasOwnProperty(event))this._listener[event] = [];
        this._listener[event].push({
            fnc,
            once: false
        });
    }

    once(event, fnc) {
        if (!this._listener.hasOwnProperty(event))this._listener[event] = [];
        this._listener[event].push({
            fnc,
            once: true
        });
    }
};