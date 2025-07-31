/// <reference path="Signal-ES6.js" />

type HandlerOnRaised = (info: SignalInfo) => any;
type HandlerOnFailed = (reason: SignalFailError) => any;
type HandlerOnFinally = () => void;
type SignalRaiser = (raiseVal?: any) => void;
type SignalThrower = (reason?: any) => void;

interface Signal {
    receive(handlerOnRaised: HandlerOnRaised, handlerOnFailed: HandlerOnFailed): Signal;
    catch(handlerOnFailed: HandlerOnFailed): Signal;
    finally(handlerOnFinally: HandlerOnFinally): Signal;
    allOver(handlerOnFinally: HandlerOnFinally): Signal;
    toOncePromise(): Promise<SignalInfo>;
}

interface SignalConstructor {
    new(executor: (raise: SignalRaiser, error: SignalThrower) => void): Signal;
    prototype: Signal;
    raise(raiseVal?: any): Signal;
    throw(reason?: any): Signal;
    withRaisers(): {
        signal: Signal;
        raise: SignalRaiser;
        throw: SignalThrower;
    }
    all(...signals: Signal[]): Signal;
    any(...signals: Signal[]): Signal;
    allSettled(...signals: Signal[]): Signal;
    race(...signals: Signal[]): Signal;
    try(fn: () => any): Signal;
    readonly NOT_RAISED: 0;
    readonly RAISED: 1;
    readonly FAILED: 2;
    readonly CLOSED: 3;
};

interface SignalInfo {
    data: any;
    signalCount: number;
    closeSignal(): void;
}

interface SignalFailError extends Error {
    message: string;
    failCount: number;
    name: string;
}

interface SignalFailErrorConstructor {
    new(cause: Error, failCount: number): SignalFailError;
    prototype: SignalFailError;
}