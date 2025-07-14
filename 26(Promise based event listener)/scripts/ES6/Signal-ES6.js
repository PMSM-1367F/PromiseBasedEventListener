/**
 * @typedef {(data: any) => any} HandlerOnRaised
 * @typedef {(reason: any) => any} HandlerOnFailed
 * @typedef {(raiseVal?: any) => void} SignalRaiser
 * @typedef {(reason?: any) => void} SignalThrower
 */

class Signal {
    static NOT_RAISED = 0;
    static RAISED = 1;
    static FAILED = 2;
    static CLOSED = 3;

    #data;
    #detector = { s: Signal.NOT_RAISED };
    /**
     * レイざーを取得
     * @param {Signal} thisArg thisとして扱う Signal インスタンスの値
     * @returns raiser
     */
    static #getRaiser(thisArg) {
        return function raiser(val) {
            thisArg.#data = val;
            // Signalのインスタンスなら シグナルのstateが1になるのを待つ
            thisArg.#data instanceof Signal ?
                thisArg.#data.receive(() => thisArg.#detector.s = Signal.RAISED) :
                thisArg.#detector.s = Signal.RAISED;
        };
    };
    /**
     * すろわーを取得
     * @param {Signal} thisArg thisとして扱う Signal インスタンスの値
     * @returns thrower
     */
    static #getThrower(thisArg) {
        return function thrower(reason) {
            thisArg.#data = reason;
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
                handlerResult.receive(data => resolver(data)) :
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
        if (!(typeof handlerOnRaised === 'function')) {
            handlerOnRaised = x => x;
        }
        if (!(typeof handlerOnFailed === 'function')) {
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
        } catch(e) {
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
    catch(handlerOnFailed){
        return this.receive(undefined, handlerOnFailed);
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
}

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
