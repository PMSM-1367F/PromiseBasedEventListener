class SignalFailError extends Error {
    constructor(cause, failCount) {
        super(SignalFailError.message, { cause });
        this.failCount = failCount;
    }
    get name() {
        return 'SignalFailError';
    }
    static get message() {
        return 'Signal has failed.';
    }
}

const Signal = (() => {
    /**
     * @typedef {(info: SignalInfo) => any} HandlerOnRaised
     * @typedef {(reason: SignalFailError) => any} HandlerOnFailed
     * @typedef {(raiseVal?: any) => void} SignalRaiser
     * @typedef {(reason?: any) => void} SignalThrower
     */

    class SignalInfo {
        constructor(info, count) {
            this.data = info;
            this.signalCount = count;
        }
    }
    /**
     * シグナル
     * @class Signal
     */
    return class Signal {
        static NOT_RAISED = 0;
        static RAISED = 1;
        static FAILED = 2;
        static CLOSED = 3;

        #data;
        #detector = { s: Signal.NOT_RAISED };
        /**
         * レイざーを取得
         * @param {Signal} thisArg thisとして扱う Signal インスタンスの値
         * @returns {SignalRaiser} raiser
         */
        static #getRaiser(thisArg) {
            let counter = 0;
            /**
             * シグナルをraiseする関数
             * @param {any} val raiseする値
             * @returns {void}
             */
            return function raiser(val) {
                thisArg.#data = new SignalInfo(val, ++counter);
                // Signalのインスタンスなら シグナルのstateが1になるのを待つ
                thisArg.#data instanceof Signal ?
                    thisArg.#data.receive(() => thisArg.#detector.s = Signal.RAISED) :
                    thisArg.#detector.s = Signal.RAISED;
            };
        };
        /**
         * すろわーを取得
         * @param {Signal} thisArg thisとして扱う Signal インスタンスの値
         * @returns {SignalThrower} thrower
         */
        static #getThrower(thisArg) {
            let failCounter = 0;
            /**
             * シグナルをfailさせる関数
             * @param {any} reason throwする理由
             * @returns {void}
             */
            return function thrower(reason) {
                thisArg.#data = new SignalFailError(reason, ++failCounter);
                thisArg.#detector.s = Signal.FAILED;
            }
        }
        /**
         * 
         * @param {SignalRaiser | SignalThrower} resolver stateを0以外にする関数
         * @param {HandlerOnRaised | HandlerOnFailed} handler ハンドラー
         * @param {Signal} thisArg thisの値
         */
        #handle(resolver, handler, thisArg) {
            let handlerResult = handler(thisArg.#data);
            (
                handlerResult instanceof Signal ?
                    handlerResult.receive(info => resolver(info)) :
                    resolver(handlerResult)
            );
        }
        /**
         * 新しいシグナル
         * @param {(raise: SignalRaiser, error: SignalThrower) => void} executor 
         */
        constructor(executor) {
            executor(Signal.#getRaiser(this), Signal.#getThrower(this));
        }
        /**
         * シグナル チェーンを形成する
         * @param {HandlerOnRaised} handlerOnRaised stateがRAISEDになったら実行される関数
         * @param {HandlerOnFailed} handlerOnFailed stateがFAILEDになったら実行される関数
         */
        receive(handlerOnRaised, handlerOnFailed) {
            if (typeof handlerOnRaised !== 'function') {
                handlerOnRaised = x => x;
            }
            if (typeof handlerOnFailed !== 'function') {
                handlerOnFailed = e => { throw e }
            }
            const currentThis = this;
            const { signal, raiser, thrower } = Signal.withRaisers();
            try {
                setTimeout(() => {
                    switch (this.#detector.s) {
                        case 1:
                            this.#handle(raiser, handlerOnRaised, currentThis);
                            break;
                        case 2:
                            this.#handle(raiser, handlerOnFailed, currentThis);
                            break;
                    }
                }, 0);
            } catch (e) {
                thrower(e);
            }
            this.#detector = new Proxy(this.#detector, {
                set(t, k, v) {
                    if (k === 's') {
                        switch (v) {
                            case 1:
                                currentThis.#handle(raiser, handlerOnRaised, currentThis);
                                break;
                            case 2:
                                currentThis.#handle(raiser, handlerOnFailed, currentThis);
                                break;
                        }
                    }
                    return Reflect.set(t, k, v);
                }
            });
            return signal;
        }
        /**
         * 
         * @param {HandlerOnFailed} handlerOnFailed 失敗時に呼び出される
         * @returns 新しいSignal
         */
        catch(handlerOnFailed) {
            return this.receive(undefined, handlerOnFailed);
        }
        toOncePromise() {
            return new Promise((resolve, reject) => {
                this.receive(resolve, reject);
            });
        }
        static raise(raiseValue) {
            return new this(raise => raise(raiseValue));
        }
        static throw(throwValue) {
            return new this((_, error) => error(throwValue));
        }
        static withRaisers() {
            const returnObj = {
                signal: new this(() => { }),
                get raiser() {
                    return Signal.#getRaiser(returnObj.signal)
                },
                get thrower() {
                    return Signal.#getThrower(returnObj.signal);
                }
            };
            return returnObj;
        }
        /**
         * 複数のシグナルをまとめて処理する
         * @param {...Signal} signals シグナルの配列
         * @returns 新しいSignal
         */
        static all(...signals) {
            return new this((raise, error) => {
                let count = 0;
                /**
                 * @type {SignalInfo[]}
                 */
                const results = [];
                signals.forEach(signal => {
                    signal.receive(
                        info => {
                            results.push(info);
                            if (++count === signals.length) {
                                raise(results);
                            }
                        },
                        err => error(err)
                    );
                });
            });
        }
        /**
         * 複数のシグナルのうち、最初に成功したものを返す
         * @param {...Signal} signals シグナルの配列
         * @returns 新しいSignal
         */
        static any(...signals) {
            return new this((raise, error) => {
                let count = 0;
                const errors = [];
                signals.forEach(signal => {
                    signal.receive(
                        info => raise(info.data),
                        err => {
                            errors.push(err);
                            if (++count === signals.length) {
                                error(new AggregateError(errors, 'All signals failed.'));
                            }
                        }
                    );
                });
            });
        }
        /**
         * 複数のシグナルの結果をまとめて返す
         * @param {...Signal} signals シグナルの配列
         * @returns 新しいSignal
         */
        static allSettled(...signals) {
            return new this((raise) => {
                let count = 0;
                /**
                 * @type {SignalInfo[]}
                 */
                const results = [];
                signals.forEach(signal => {
                    signal.receive(
                        info => {
                            results.push({data: info.data, status: 'raised'});
                            if (++count === signals.length) {
                                raise(results);
                            }
                        },
                        err => {
                            results.push({reason: err.cause, status: 'failed'});
                            if (++count === signals.length) {
                                raise(results);
                            }
                        }
                    );
                });
            });
        }
    }
})();

class EventSignal extends Signal {
    /**
     * イベントリスナーを登録
     * @param {HTMLElement} element イベント 要素
     * @param {keyof WindowEventMap} evType イベント タイプ
     * @param {AddEventListenerOptions} options イベント オプション
     */
    static addEventListenerTo(element, evType, options) {
        return new this(raise => element.addEventListener(evType, function (e) {
            raise(e);
        }, options));
    }
}
