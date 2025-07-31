/**
 * @type {SignalFailErrorConstructor}
 */
const SignalFailError = class SignalFailError extends Error {
    constructor(cause, failCount) {
        super(SignalFailError.message, { cause });
        this.failCount = failCount;
        console.error('(In Signal)', this.message, cause);
    }
    get name() {
        return 'SignalFailError';
    }
    static get message() {
        return 'Signal has failed.';
    }
}

/**
 * @type {SignalConstructor}
 */
const Signal = (() => {
    /**
     * シグナル
     * @class Signal
     */
    class Signal {
        /**
         * @readonly
         */
        static NOT_RAISED = 0;
        /**
         * @readonly
         */
        static RAISED = 1;
        /**
         * @readonly
         */
        static FAILED = 2;
        /**
         * @readonly
         */
        static CLOSED = 3;

        static #SignalInfo = class SignalInfo {
            /**
             * @type {Signal}
             * @private
             */
            #signal;
            /**
             * @param {any} info シグナルの情報
             * @param {number} count シグナルのカウント
             * @param {Signal} signal シグナルのインスタンス
             * @constructor
             */
            constructor(info, count, signal) {
                this.data = info;
                this.signalCount = count;
                this.#signal = signal;
            }

            closeSignal() {
                if (this.#signal) {
                    this.#signal.#detector.state = Signal.CLOSED;
                    this.#signal.#data = null;
                }
            }
        }

        /**
         * @type {SignalInfo | SignalFailError}
         * @private
         */
        #data;
        #detector = {
            get state() {
                return this.s || Signal.NOT_RAISED;
            },
            set state(state) {
                this.s = state;
            }
        };

        /**
         * @type {HandlerOnRaised}
         */
        #onRaise;
        /**
         * @type {HandlerOnFailed}
         */
        #onError;
        /**
         * @type {HandlerOnFinally}
         */
        #onAll;

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
                if (thisArg.#detector.state === Signal.CLOSED) return;
                thisArg.#data = new Signal.#SignalInfo(val, ++counter, thisArg);
                // Signalのインスタンスなら シグナルのstateが1になるのを待つ
                thisArg.#data.data instanceof Signal ?
                    thisArg.#data.data.receive(() => thisArg.#detector.state = Signal.RAISED) :
                    thisArg.#detector.state = Signal.RAISED;
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
                if (thisArg.#detector.state === Signal.CLOSED) return;
                thisArg.#data = reason instanceof AggregateError ? reason : new SignalFailError(reason, ++failCounter, false);
                thisArg.#detector.state = Signal.FAILED;
            }
        }
        /**
         * 
         * @param {SignalRaiser | SignalThrower | null} resolver stateを0以外にする関数
         * @param {HandlerOnRaised | HandlerOnFailed | HandlerOnFinally} handler ハンドラー
         */
        #handle(resolver, handler) {
            const handlerResult = handler(this.#data);
            if (this.#detector.state === 3) {
                resolver ?? (handler());
                return;
            }
            (
                handlerResult instanceof Signal ?
                    handlerResult.receive(info => resolver?.(info.data)) :
                    resolver?.(handlerResult)
            );
        }
        /**
         * 
         * @param {HandlerOnRaised} handlerOnRaised 
         * @param {HandlerOnFailed} handlerOnFailed 
         * @param {HandlerOnFinally} onAllOver 
         * @returns 
         */
        #signalReceive(handlerOnRaised, handlerOnFailed, onAllOver) {
            if (typeof handlerOnRaised !== 'function') {
                handlerOnRaised = x => x;
            }
            if (typeof handlerOnFailed !== 'function') {
                handlerOnFailed = e => { throw e }
            }
            if (typeof onAllOver !== 'function') {
                onAllOver = () => {}
            }
            this.#onRaise = handlerOnRaised;
            this.#onError = handlerOnFailed;
            this.#onAll = onAllOver;
            const { signal, raiser, thrower } = Signal.withRaisers();
            try {
                setTimeout(() => {
                    switch (this.#detector.state) {
                        case 1:
                            this.#handle(raiser, this.#onRaise);
                            break;
                        case 2:
                            this.#handle(raiser, this.#onError);
                            break;
                        case 3:
                            this.#handle(null, this.#onAll);
                            setTimeout(() => signal.#detector.state = 3);
                            break;
                    }
                }, 0);
            } catch (e) {
                thrower(e);
            }
            Object.defineProperty(this.#detector, 'state', {
                set: (state) => {
                    switch (state) {
                        case 1:
                            this.#handle(raiser, this.#onRaise);
                            break;
                        case 2:
                            this.#handle(raiser, this.#onError);
                            break;
                        case 3:
                            this.#handle(null, this.#onAll);
                            setTimeout(() => signal.#detector.state = 3);
                            break;
                    }
                    this.#detector.s = state;
                },
            });
            return signal;
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
            return this.#signalReceive(handlerOnRaised, handlerOnFailed)
        }
        /**
         * 
         * @param {HandlerOnFailed} handlerOnFailed 失敗時に呼び出される
         * @returns 新しいSignal
         */
        catch(handlerOnFailed) {
            return this.#signalReceive(undefined, handlerOnFailed);
        }
        /**
         * 
         * @param {HandlerOnFinally} handlerOnFinally 決定時に呼び出される
         * @returns 新しいシグナル
         */
        finally(handlerOnFinally) {
            return this.#signalReceive(v => {
                handlerOnFinally();
                return v.data;
            }, e => {
                handlerOnFinally();
                throw e.cause;
            }, () => handlerOnFinally());
        }
        /**
         * 
         * @param {HandlerOnFinally} handlerOnFinally シグナルが閉まったときに呼び出される
         */
        allOver(handlerOnFinally) {
            return this.#signalReceive(undefined, undefined, handlerOnFinally);
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
            return {
                signal: new this(() => { }),
                get raiser() {
                    return Signal.#getRaiser(this.signal)
                },
                get thrower() {
                    return Signal.#getThrower(this.signal);
                }
            };
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
                            results.push({ data: info.data, status: 'raised' });
                            if (++count === signals.length) {
                                raise(results);
                            }
                        },
                        err => {
                            results.push({ reason: err.cause, status: 'failed' });
                            if (++count === signals.length) {
                                raise(results);
                            }
                        }
                    );
                });
            });
        }
        /**
         * 複数のシグナルのうち、最初に解決したものを返す
         * @param {...Signal} signals シグナルの配列
         * @returns 新しいSignal
         */
        static race(...signals) {
            return new this((raise, error) => {
                let isSomeSignalResolved = false;
                signals.forEach(signal => {
                    signal.receive(
                        info => {
                            if (!isSomeSignalResolved) {
                                isSomeSignalResolved = true;
                                raise(info.data);
                            }
                        },
                        err => {
                            if (!isSomeSignalResolved) {
                                isSomeSignalResolved = true;
                                error(err.cause);
                            }
                        }
                    );
                });
            });
        }
        static try(callBack) {
            return new this((raise, error) => {
                try {
                    const result = callBack();
                    if (result instanceof Signal) {
                        result.receive((inf) => raise(inf.data), (err) => error(err.cause));
                    } else {
                        raise(result);
                    }
                } catch (e) {
                    error(e);
                }
            });
        }
    }
    return Signal;
})();

class EventSignal extends Signal {
    /**
     * イベントリスナーを登録
     * @param {EventTarget} element イベント 要素
     * @param {keyof ElementEventMap} evType イベント タイプ
     * @param {AddEventListenerOptions} options イベント オプション
     */
    static addEventListenerTo(element, evType, options) {
        return new this(raise => element.addEventListener(evType, function (e) {
            raise(e);
        }, options));
    }
}
