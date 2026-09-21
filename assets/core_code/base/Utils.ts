import { isValid, Label, UITransform, Vec2, Node, instantiate } from "cc";
// import qrcode from "qrcode-generator";

export class Utils {
    public static format(str: string, ...args: any[]) {
        var l = args.length;
        if (l < 1) return str;

        var needToFormat = true;
        if (typeof str === "object") {
            needToFormat = false;
        }
        for (var i = 0; i < l; ++i) {
            var arg = args[i];
            if (needToFormat) {
                while (true) {
                    var result = null;
                    if (typeof arg === "number") {
                        result = str.match(/(%d)|(%s)/);
                        if (result) {
                            //number 不能直接作为 replace 的替换串，转成字符串（与引擎 ToString 行为一致）
                            str = str.replace(/(%d)|(%s)/, String(arg));
                            break;
                        }
                    }
                    result = str.match(/%s/);
                    if (result) str = str.replace(/%s/, arg);
                    else str += " " + arg;
                    break;
                }
            } else str += " " + arg;
        }
        return str;
    }

    public static getWeightRate(weights: Array<number>): Array<number> {
        let sum = weights.reduce((a, b) => a + b, 0);

        let curRands = [];
        let curRand = 0;
        for (let weight of weights) {
            curRand += weight;
            curRands.push(curRand / sum);
        }
        return curRands;
    }

    public static arrStringify(arr: Array<any>) {
        let str = "";
        for (let s of arr) {
            str = str + " " + Utils.toString(s);
        }
        return str;
    }

    public static toString(s: any): string {
        if (s == null) {
            return "null";
        } else if (s === undefined) {
            return "undefined";
            // tslint:disable-next-line: use-isnan
        } else if (Number.isNaN(s)) {
            return "NaN";
        } else {
            return s.toString();
        }
    }

    public static map2Obj(map: Map<any, any>): any {
        const obj: { [key: string]: any } = {};
        for (let [k, v] of map) {
            obj[k] = v;
        }
        return obj;
    }

    public static calculateCenter2D(points: Vec2[]): Vec2 {
        if (points.length === 0) {
            throw new Error("点的数组不能为空");
        }

        const sumX = points.reduce((acc, point) => acc + point.x, 0);
        const sumY = points.reduce((acc, point) => acc + point.y, 0);

        const centerX = sumX / points.length;
        const centerY = sumY / points.length;

        return new Vec2(centerX, centerY);
    }

    public static isNullOrEmpty(obj: any): boolean {
        return obj === null || obj === undefined || (typeof obj === "object" && Object.keys(obj).length === 0);
    }

    public static getTextCount(label: Label, text: string, count: number): number {
        if (!isValid(label)) {
            egf.Logger.log("getTextCount label is unvalid");
            return count;
        }
        label.string = text;
        label.updateRenderData(true);
        label.node.updateWorldTransform();
        // egf.Logger.log(
        //   'getTextCount label.height:',
        //   text.length,
        //   label.getComponent(UITransform).height,
        //   count,
        // );

        if (label.getComponent(UITransform)!.height > 2000) {
            count += 2;
            const midIndex = Math.floor(text.length / 2);
            return this.getTextCount(label, text.slice(0, midIndex), count);
        } else {
            if (count == 0) {
                count = 1;
            }
            return count;
        }
    }

    public static getLabelItems(item: Node, text: string): Array<Node> {
        const nodes: Array<Node> = [];
        const count = this.getTextCount(item.getComponent(Label)!, text, 0);
        const num = Math.floor(text.length / count);
        egf.Logger.log("clickInfo:", count, num, text.length);
        for (let i = 0; i < count; i++) {
            const str = text.slice(i * num, (i + 1) * num);
            const nodeLabel = instantiate(item);
            nodeLabel.getComponent(Label)!.string = str;
            nodes.push(nodeLabel);
        }
        return nodes;
    }

    static uploadImage(
        blob: Blob,
        presignedUrl: string,
        imageType: string,
        callback: (error: Error | null, url?: string) => void,
    ) {
        let xhr = new XMLHttpRequest();
        xhr.open("PUT", presignedUrl, true);
        xhr.setRequestHeader("Content-Type", imageType);

        // 添加上传进度监听
        if (xhr.upload) {
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = (event.loaded / event.total) * 100;
                    egf.Logger.log("upload progress:", percent);
                }
            };
        }

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    callback(null, xhr.responseText);
                } else {
                    callback(new Error(`S3 Upload failed: ${xhr.status}`));
                }
            }
        };

        xhr.send(blob);
    }

    static copyToClipboard(text: string) {
        if (navigator.clipboard && window.isSecureContext) {
            // navigator clipboard 方式
            navigator.clipboard.writeText(text);
        }
    }

    static getCodeFromClipboard(): Promise<string> {
        if (navigator.clipboard && window.isSecureContext) {
            // navigator clipboard 方式
            return navigator.clipboard.readText();
        }
        return Promise.resolve("");
    }

    // static generateQRCodeBase64(text: string, scale = 6, margin = 4): string {
    //     const qr = qrcode(0, "M");
    //     qr.addData(text);
    //     qr.make();

    //     return qr.createDataURL(scale, margin);
    // }

    /**
     * 格式化金额，保留2位小数，最后是0则不保留
     */
    static formatAmount(value: number | string): string {
        const num = typeof value === "string" ? parseFloat(value) : value;
        // 使用 toFixed(2) 获取2位小数，然后移除末尾的0
        return num.toFixed(2).replace(/\.?0+$/, "");
    }

    /**
     * !#zh 拷贝object。
     */
    /**
     * 深度拷贝
     * @param {any} sObj 拷贝的对象
     * @returns
     */
    public static clone(sObj: any) {
        if (sObj === null || typeof sObj !== "object") {
            return sObj;
        }

        let s: { [key: string]: any } = {};
        if (sObj.constructor === Array) {
            s = [];
        }

        for (let i in sObj) {
            if (sObj.hasOwnProperty(i)) {
                s[i] = this.clone(sObj[i]);
            }
        }

        return s;
    }

    /**
     * 将object转化为数组
     * @param { any} srcObj
     * @returns
     */
    public static objectToArray(srcObj: { [key: string]: any }) {
        let resultArr: any[] = [];

        // to array
        for (let key in srcObj) {
            if (!srcObj.hasOwnProperty(key)) {
                continue;
            }

            resultArr.push(srcObj[key]);
        }

        return resultArr;
    }

    /**
     * !#zh 将数组转化为object。
     */
    /**
     * 将数组转化为object。
     * @param { any} srcObj
     * @param { string} objectKey
     * @returns
     */
    public static arrayToObject(srcObj: any, objectKey: string) {
        let resultObj: { [key: string]: any } = {};

        // to objec
        for (let key in srcObj) {
            if (!srcObj.hasOwnProperty(key) || !srcObj[key][objectKey]) {
                continue;
            }

            resultObj[srcObj[key][objectKey]] = srcObj[key];
        }

        return resultObj;
    }

    /**
     * 根据权重,计算随机内容
     * @param {arrany} weightArr
     * @param {number} totalWeight 权重
     * @returns
     */
    public static getWeightRandIndex(weightArr: [], totalWeight: number) {
        let randWeight: number = Math.floor(Math.random() * totalWeight);
        let sum: number = 0;
        //注意：weightIndex 必须声明在循环外——函数末尾会返回它（原来靠 var 的函数级提升，改 let 会直接报错）
        let weightIndex: number = 0;
        for (; weightIndex < weightArr.length; weightIndex++) {
            sum += weightArr[weightIndex];
            if (randWeight < sum) {
                break;
            }
        }

        return weightIndex;
    }

    /**
     * 从n个数中获取m个随机数
     * @param {Number} n   总数
     * @param {Number} m    获取数
     * @returns {Array} array   获取数列
     */
    public static getRandomNFromM(n: number, m: number) {
        let array: any[] = [];
        let intRd: number = 0;
        let count: number = 0;

        while (count < m) {
            if (count >= n + 1) {
                break;
            }

            intRd = this.getRandomInt(0, n);
            let flag = 0;
            for (let i = 0; i < count; i++) {
                if (array[i] === intRd) {
                    flag = 1;
                    break;
                }
            }

            if (flag === 0) {
                array[count] = intRd;
                count++;
            }
        }

        return array;
    }

    /**
     * 获取随机整数
     * @param {Number} min 最小值
     * @param {Number} max 最大值
     * @returns
     */
    public static getRandomInt(min: number, max: number) {
        let r: number = Math.random();
        let rr: number = r * (max - min + 1) + min;
        return Math.floor(rr);
    }

    /**
     * 获取字符串长度
     * @param {string} render
     * @returns
     */
    public static getStringLength(render: string) {
        let strArr: string = render;
        let len: number = 0;
        for (let i: number = 0, n = strArr.length; i < n; i++) {
            let val: number = strArr.charCodeAt(i);
            if (val <= 255) {
                len = len + 1;
            } else {
                len = len + 2;
            }
        }

        return Math.ceil(len / 2);
    }

    /**
     * 判断传入的参数是否为空的Object。数组或undefined会返回false
     * @param obj
     */
    public static isEmptyObject(obj: any) {
        let result: boolean = true;
        if (obj && obj.constructor === Object) {
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    result = false;
                    break;
                }
            }
        } else {
            result = false;
        }

        return result;
    }

    /**
     * 获取对象属性数量
     * @param {object}o 对象
     * @returns
     */
    public static getPropertyCount(o: Object) {
        let n,
            count = 0;
        for (n in o) {
            if (o.hasOwnProperty(n)) {
                count++;
            }
        }
        return count;
    }

    /**
     * 返回一个差异化数组（将array中diff里的值去掉）
     * @param array
     * @param diff
     */
    public static difference(array: [], diff: any) {
        let result: any[] = [];
        if (array.constructor !== Array || diff.constructor !== Array) {
            return result;
        }

        let length = array.length;
        for (let i: number = 0; i < length; i++) {
            if (diff.indexOf(array[i]) === -1) {
                result.push(array[i]);
            }
        }

        return result;
    }

    public static _stringToArray(string: string) {
        // 用于判断emoji的正则们
        let rsAstralRange = "\\ud800-\\udfff";
        let rsZWJ = "\\u200d";
        let rsVarRange = "\\ufe0e\\ufe0f";
        let rsComboMarksRange = "\\u0300-\\u036f";
        let reComboHalfMarksRange = "\\ufe20-\\ufe2f";
        let rsComboSymbolsRange = "\\u20d0-\\u20ff";
        let rsComboRange = rsComboMarksRange + reComboHalfMarksRange + rsComboSymbolsRange;
        let reHasUnicode = RegExp("[" + rsZWJ + rsAstralRange + rsComboRange + rsVarRange + "]");

        let rsFitz = "\\ud83c[\\udffb-\\udfff]";
        let rsOptlet = "[" + rsVarRange + "]?";
        let rsCombo = "[" + rsComboRange + "]";
        let rsModifier = "(?:" + rsCombo + "|" + rsFitz + ")";
        let reOptMod = rsModifier + "?";
        let rsAstral = "[" + rsAstralRange + "]";
        let rsNonAstral = "[^" + rsAstralRange + "]";
        let rsRegional = "(?:\\ud83c[\\udde6-\\uddff]){2}";
        let rsSurrPair = "[\\ud800-\\udbff][\\udc00-\\udfff]";
        let rsOptJoin =
            "(?:" + rsZWJ + "(?:" + [rsNonAstral, rsRegional, rsSurrPair].join("|") + ")" + rsOptlet + reOptMod + ")*";
        let rsSeq = rsOptlet + reOptMod + rsOptJoin;
        let rsSymbol = "(?:" + [rsNonAstral + rsCombo + "?", rsCombo, rsRegional, rsSurrPair, rsAstral].join("|") + ")";
        let reUnicode = RegExp(rsFitz + "(?=" + rsFitz + ")|" + rsSymbol + rsSeq, "g");

        let hasUnicode = function (val: string) {
            return reHasUnicode.test(val);
        };

        let unicodeToArray = function (val: string) {
            return val.match(reUnicode) || [];
        };

        let asciiToArray = function (val: string) {
            return val.split("");
        };

        return hasUnicode(string) ? unicodeToArray(string) : asciiToArray(string);
    }

    public static trim(str: string) {
        return str.replace(/(^\s*)|(\s*$)/g, "");
    }

    /**
     * 判断当前时间是否在有效时间内
     * @param {String|Number} start 起始时间。带有时区信息
     * @param {String|Number} end 结束时间。带有时区信息
     */
    public static isNowValid(start: string | number, end: string | number) {
        let startTime = new Date(start);
        let endTime = new Date(end);
        let result = false;

        if (startTime.getDate() + "" !== "NaN" && endTime.getDate() + "" !== "NaN") {
            let curDate = new Date();
            result = curDate < endTime && curDate > startTime;
        }

        return result;
    }

    /**
     * 获取数组最小值
     * @param array 数组
     * @returns
     */
    public static getMin(array: number[]) {
        let result: number = null!;
        if (array.constructor === Array) {
            let length = array.length;
            for (let i = 0; i < length; i++) {
                if (i === 0) {
                    result = Number(array[0]);
                } else {
                    result = result > Number(array[i]) ? Number(array[i]) : result;
                }
            }
        }

        return result;
    }

    /**
     * 格式化两位小数点
     * @param time
     * @returns
     */
    public static formatTwoDigits(time: number) {
        //@ts-ignore
        return (Array(2).join(0) + time).slice(-2);
    }

    /**
     * 格式化名字，XXX...
     * @param {string} name 需要格式化的字符串
     * @param {number}limi
     * @returns {string} 返回格式化后的字符串XXX...
     */
    public static formatName(name: string, limit: number) {
        limit = limit || 6;
        let nameArray = this._stringToArray(name);
        let str = "";
        let length = nameArray.length;
        if (length > limit) {
            for (let i = 0; i < limit; i++) {
                str += nameArray[i];
            }

            str += "...";
        } else {
            str = name;
        }

        return str;
    }

    /**
     * 格式化钱数，超过10000 转换位 10K   10000K 转换为 10M
     * @param {number}money 需要被格式化的数值
     * @returns {string}返回 被格式化的数值
     */
    public static formatMoney(money: number) {
        let arrUnit: string[] = ["", "K", "M", "G", "T", "P", "E", "Z", "Y", "B", "N", "D"];

        let strValue: string = "";
        for (let idx: number = 0; idx < arrUnit.length; idx++) {
            if (money >= 10000) {
                money /= 1000;
            } else {
                strValue = Math.floor(money) + arrUnit[idx];
                break;
            }
        }

        if (strValue === "") {
            strValue = Math.floor(money) + "U"; //超过最大值就加个U
        }

        return strValue;
    }

    /**
     * 格式化数值
     * @param {number}value 需要被格式化的数值
     * @returns {string}返回 被格式化的数值
     */
    public static formatValue(value: number) {
        let arrUnit: string[] = [];
        let strValue: string = "";
        for (let i = 0; i < 26; i++) {
            arrUnit.push(String.fromCharCode(97 + i));
        }

        for (let idx: number = 0; idx < arrUnit.length; idx++) {
            if (value >= 10000) {
                value /= 1000;
            } else {
                strValue = Math.floor(value) + arrUnit[idx];
                break;
            }
        }

        return strValue;
    }

    /**
     * 将数组内容进行随机排列
     * @param {Array}arr 需要被随机的数组
     * @returns
     */
    public static rand(arr: []): [] {
        let arrClone = this.clone(arr);
        // 首先从最大的数开始遍历，之后递减
        for (let i: number = arrClone.length - 1; i >= 0; i--) {
            // 随机索引值randomIndex是从0-arrClone.length中随机抽取的
            const randomIndex: number = Math.floor(Math.random() * (i + 1));
            // 下面三句相当于把从数组中随机抽取到的值与当前遍历的值互换位置
            const itemIndex: number = arrClone[randomIndex];
            arrClone[randomIndex] = arrClone[i];
            arrClone[i] = itemIndex;
        }
        // 每一次的遍历都相当于把从数组中随机抽取（不重复）的一个元素放到数组的最后面（索引顺序为：len-1,len-2,len-3......0）
        return arrClone;
    }

    /**
     * 返回指定小数位的数值
     * @param {number} num
     * @param {number} idx
     */
    public static formatNumToFixed(num: number, idx: number = 0) {
        return Number(num.toFixed(idx));
    }

    /**
     * 用于数值到达另外一个目标数值之间进行平滑过渡运动效果
     * @param {number} targetValue 目标数值
     * @param {number} curValue 当前数值
     * @param {number} ratio    过渡比率
     * @returns
     */
    public static lerp(targetValue: number, curValue: number, ratio: number = 0.25) {
        let v: number = curValue;
        if (targetValue > curValue) {
            v = curValue + (targetValue - curValue) * ratio;
        } else if (targetValue < curValue) {
            v = curValue - (curValue - targetValue) * ratio;
        }

        return v;
    }
}
