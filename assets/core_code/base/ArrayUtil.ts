export class ArrayUtil {
    public static has(array: unknown[], v: unknown): boolean {
        if (!array) return false;
        if (array.length <= 0) return false;
        return array.indexOf(v) != -1;
    }

    public static shuffle(array: unknown[]): void {
        if (!array || array.length <= 1) return;
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    public static remove(array: unknown[], v: unknown): boolean {
        if (!array) return false;
        if (array.length <= 0) return false;
        const idx: number = array.indexOf(v);
        if (idx === -1) return false;
        array.splice(idx, 1);
    }

    public static removeMultiIdx(arr: any[], indices: number[]) {
        if (!indices) return arr;
        if (indices.length <= 0) return arr;
        const result: any[] = [];
        const removedIndices: Set<number> = new Set(indices);
        for (let i = 0; i < arr.length; i++) {
            if (!removedIndices.has(i)) {
                result.push(arr[i]);
            }
        }
        return result;
    }

    public static pickItem<T>(array: T[]): T {
        if (!array) return null;
        if (array.length <= 0) return null;
        let idx: number = Math.floor(Math.random() * array.length);
        return array[idx];
    }

    public static pickIndex(array: any[]): number {
        if (!array) return null;
        if (array.length <= 0) return null;
        let idx: number = Math.floor(Math.random() * array.length);
        return idx;
    }

    public static pickItems<T>(
        array: T[],
        cnt: number,
        diff: boolean = false,
    ): T[] {
        if (!array) return null;
        if (array.length <= 0) return null;
        let res: T[] = [];
        if (!diff) {
            for (let i = 0; i < cnt; i++) {
                let item: T = this.pickItem(array);
                res.push(item);
            }
            return res;
        } else {
            let arr: T[] = [...array];
            for (let i = 0; i < cnt; i++) {
                let idx: number = this.pickIndex(arr);
                let item: T = arr[idx];
                res.push(item);
                arr.splice(idx, 1);
                if (arr.length <= 0) break;
            }
            return res;
        }
    }

    public static pickIndexs(
        array: any[],
        cnt: number,
        diff: boolean = false,
    ): number[] {
        if (!array) return null;
        if (array.length <= 0) return null;
        let res: number[] = [];
        if (!diff) {
            for (let i = 0; i < cnt; i++) {
                let idx: number = this.pickIndex(array);
                res.push(idx);
            }
            return res;
        } else {
            let arr: any[] = [...array];
            for (let i = 0; i < cnt; i++) {
                let idx: number = this.pickIndex(arr);
                res.push(idx);
                arr.splice(idx, 1);
                if (arr.length <= 0) break;
            }
            return res;
        }
    }

    public static removeSame(
        arr: any[],
        minCnt: number,
        compareFunc?: Function,
    ) {
        if (!compareFunc) {
            compareFunc = (a, b) => {
                return a === b;
            };
        }

        const removeIdxArr: number[][] = [];
        const indices: number[] = [];
        let sameCnt: number = 1;
        for (let i = 1; i < arr.length; i++) {
            const isSame: boolean = compareFunc(arr[i], arr[i - 1]);
            if (isSame) {
                sameCnt++;
                if (sameCnt >= minCnt) {
                    const idxArr: number[] = [];
                    removeIdxArr.push(idxArr);
                    for (let j = 0; j < minCnt; j++) {
                        const idx: number = i + j - sameCnt + 1;
                        idxArr.push(idx);
                        indices.push(idx);
                    }
                }
            } else {
                sameCnt = 1;
            }
        }

        arr = this.removeMultiIdx(arr, indices);

        return { removeIdxArr, arr };
    }

    public static isAllSame<T>(arr: T[], property?: string): boolean {
        if (property)
            return arr.every((val) => val[property] === arr[0][property]);
        else return arr.every((val) => val === arr[0]);
    }
}
