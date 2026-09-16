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
                            str = str.replace(/(%d)|(%s)/, arg);
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

    public static formatUTCTimestamp(timestamp: number): string {
        const date = new Date(Math.floor(timestamp));
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1; // 月份从0开始，需要加1
        const day = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        // 确保月、日、小时、分钟、秒是两位数
        const pad = (num: number): string => (num < 10 ? `0${num}` : num.toString());

        return `${year}/${pad(month)}/${pad(day)} ${pad(hours)}:${pad(minutes)}:${pad(seconds)} UTC`;
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

    public static convertSecondsToTimeFormat(seconds: number) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const padNumber = (num: number): string => (num < 10 ? `0${num}` : `${num}`);
        let timer = "";
        if (days > 0) {
            timer = `${days}D ${padNumber(hours)}:${padNumber(minutes)}:${padNumber(secs)}`;
        } else if (hours > 0) {
            timer = `${padNumber(hours)}:${padNumber(minutes)}:${padNumber(secs)}`;
        } else {
            timer = `${padNumber(minutes)}:${padNumber(secs)}`;
        }
        return timer;
    }

    public static convertSecondsToDHM(seconds: number) {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const padNumber = (num: number): string => (num < 10 ? `0${num}` : `${num}`);
        let timer = "";
        if (days > 0) {
            timer = `${days} ${egf.i18nMgr.getText("Days")} ${padNumber(hours)}:${padNumber(minutes)}`;
        } else if (hours > 0) {
            timer = `${padNumber(hours)}:${padNumber(minutes)}}`;
        } else {
            timer = `${padNumber(minutes)}:${padNumber(secs)}`;
        }
        return timer;
    }

    static formatToK(value: number): string {
        const num = value || 0; // 处理 null/undefined
        if (num >= 1e9) {
            // 十亿级：先转换为十亿单位，再保留两位小数
            return `${Math.floor(num / 1e7) / 100}B`; // 1e7 = 10,000,000
        } else if (num >= 1e6) {
            // 百万级：先转换为百万单位，再保留两位小数
            return `${Math.floor(num / 1e4) / 100}M`; // 1e4 = 10,000
        } else if (num >= 1e5) {
            // 100K级：核心修改点
            const formatted = Math.floor(num / 10) / 100; // 通过先除10再除100保留两位小数
            return `${formatted.toFixed(2).replace(/\.00$/, "")}K`; // 9996 → 999.6 → 9.99K
        } else {
            // 小于100k时保留两位小数
            return num.toFixed(2).replace(/\.00$/, "");
        }
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
}
