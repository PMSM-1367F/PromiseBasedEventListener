class Thenable {
    /**
     * @abstract
     * @param {() => void} res 解決
     * @param {() => void} _rej 拒否
     */
    then(res, _rej){
        res('default resolve value');
    }
    static isThenable(value){
        const getPT = Object.getPrototypeOf;
        for(let cProto = getPT(value); cProto; cProto = getPT(cProto)){
            if(Object.hasOwn(cProto, 'then')){
                return true;
            }
        }
        if(Object.hasOwn(value, 'then')){
            return true;
        }
        return false;
    }
    static [Symbol.hasInstance](value){
        return this.isThenable(value);
    }
}