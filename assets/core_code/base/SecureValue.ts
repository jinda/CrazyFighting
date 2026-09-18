/**
 * 内存数值加密工具
 * 采用仿射变换(随机乘数 + 随机偏移)实现内存加密
 * 每次运行随机密钥, 防止内存扫描固定值查找
 */
export class SecureValue {
    private _v = 0; //加密后的值(内存中只存它)
    private _m = 1; //随机乘数(每次运行随机)
    private _k = 0; //随机偏移(每次运行随机)

    constructor(val = 0) {
        this._m = Math.floor(Math.random() * 999 + 2); //2~1000
        this._k = Math.floor(Math.random() * 0xffff); //0~65535
        this.set(val);
    }

    get(): number {
        return Math.round((this._v - this._k) / this._m);
    }

    set(val: number): void {
        this._v = val * this._m + this._k;
    }

    toJSON(): number {
        return this.get();
    }
}
