/**
 * @constructor
 * @param {(raise: (raiseVal: any) => void) => void} executor 
 */
function Signal(executor) {
    this.detector = { state: 0, setState() { } };
    this.data = null;
    const raiser = val => (
        this.data = val,
        // Signalのインスタンスなら シグナルのstateが1になるのを待つ
        this.data instanceof Signal ?
            this.data.receive(() => this.detector.setState(1)) :
            this.detector.setState(1)
    );
    executor(raiser);
}
Signal.prototype.receive = function receive(handler){
    const currentThis = this;
    this.detector.setState = function setState(val){
        if(val === 1){
            raiser(handler(currentThis.data));
        }
    }
    let raiser;
    return new Signal(function(raise){
        raiser = raise;
    });
}