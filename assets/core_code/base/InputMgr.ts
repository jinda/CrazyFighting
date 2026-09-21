export class InputManager {
    private STATE_NORMAL = 1;
    private STATE_KEEP = 2;

    private static _inst: InputManager | null = null;
    private _flags: { [key: string]: any } = {};
    private _flagsMeta: { [key: string]: any } = {};
    public static get inst(): InputManager {
        if (!this._inst) {
            this._inst = new InputManager();
        }
        return this._inst;
    }

    public setFlag(flag: string, keep?: boolean, meta?: any) {
        this._flags[flag] = keep ? this.STATE_KEEP : this.STATE_NORMAL;
        if (meta != null) {
            this._flagsMeta[flag] = meta;
        }
    }

    public removeFlag(flag: string) {
        delete this._flags[flag];
    }

    public hasFlag(flag: string): boolean {
        return !!this._flags[flag];
    }

    public getMetaByFlag(flag: string): any {
        return this._flagsMeta[flag];
    }

    public update() {
        for (let k in this._flags) {
            if (this._flags[k] != this.STATE_KEEP) {
                this._flags[k] = 0;
            }
        }
    }
}

export const InputMgr = InputManager.inst;
