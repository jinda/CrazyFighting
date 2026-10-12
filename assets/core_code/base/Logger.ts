import { DEV } from "cc/env";
import { Utils } from "./Utils";

/**
 * Logger:日志相关接口
 * @author jinda
 * @description 日志分级、日志打印、日志保存
 */
export default class Logger {
    /** log标签 */
    public static GLOBAL_TAG: string = "LOG_TAG";
    /** log 日志信息 */
    private static _logArr: Array<string> = [];
    /** log状态 */
    private static _logStatus: boolean = DEV;

    public static log(message?: any, ...optionalParams: any[]): void {
        if (!Logger._logStatus) {
            return;
        }
        Logger.checkLogArrLong();
        Logger._logArr.push(
            "[log][" +
                Logger.getFullTime() +
                "]" +
                Logger.GLOBAL_TAG +
                ":" +
                message +
                Utils.arrStringify(optionalParams) +
                "\n",
        );
        // tslint:disable-next-line: no-console
        console.log("[log][", Logger.getFullTime(), "]", Logger.GLOBAL_TAG, ":", message, ...optionalParams);
    }

    public static debug(message?: any, ...optionalParams: any[]): void {
        if (!Logger._logStatus) {
            return;
        }
        Logger.checkLogArrLong();
        Logger._logArr.push(
            "[debug][" +
                Logger.getFullTime() +
                "]" +
                Logger.GLOBAL_TAG +
                ":" +
                message +
                Utils.arrStringify(optionalParams) +
                "\n",
        );
        // tslint:disable-next-line: no-console
        console.debug("[debug][", Logger.getFullTime(), "]", Logger.GLOBAL_TAG, ":", message, ...optionalParams);
    }

    public static warn(message?: any, ...optionalParams: any[]): void {
        Logger.checkLogArrLong();
        Logger._logArr.push(
            "[warn][" +
                Logger.getFullTime() +
                "]" +
                Logger.GLOBAL_TAG +
                ":" +
                message +
                Utils.arrStringify(optionalParams) +
                "\n",
        );
        // tslint:disable-next-line: no-console
        console.warn("[warn][", Logger.getFullTime(), "]", Logger.GLOBAL_TAG, ":", message, ...optionalParams);
    }

    public static error(message?: any, ...optionalParams: any[]): void {
        Logger.checkLogArrLong();
        Logger._logArr.push(
            "[error][" +
                Logger.getFullTime() +
                "]" +
                Logger.GLOBAL_TAG +
                ":" +
                message +
                Utils.arrStringify(optionalParams) +
                "\n",
        );
        // tslint:disable-next-line: no-console
        console.error("[error][", Logger.getFullTime(), "]", Logger.GLOBAL_TAG, ":", message, ...optionalParams);
    }

    /** 写入文件保存 */
    public static save(cb?: () => void): void {}

    /** 获取完全时间 */
    public static getFullTime(): string {
        let date = new Date();
        const pad = (n: number) => (n < 10 ? "0" + n : "" + n);
        return (
            pad(date.getHours()) +
            ":" +
            pad(date.getMinutes()) +
            ":" +
            pad(date.getSeconds()) +
            "-" +
            date.getMilliseconds()
        );
    }

    /** 获取文件名 */
    public static getFileName(): string {
        let date = new Date();
        return (
            date.getMonth() +
            "-" +
            date.getDate() +
            "_" +
            date.getHours() +
            ":" +
            date.getMinutes() +
            ":" +
            date.getSeconds() +
            ".log"
        );
    }

    /** 设置普通日志状态；警告和错误始终保留。 */
    public static setLogStatus(flag: boolean): void {
        Logger._logStatus = flag;
        if (flag) {
            // 定时保存日志
            // setInterval(() => {
            //     Logger.save();
            // }, 1000 * 15);
        }
    }

    /**
     * checkLogArrLong: 检查日志数组是否过长，超过一定长度则删除删除最早的日志
     */
    public static checkLogArrLong() {
        if (Logger._logArr.length > 300) {
            Logger._logArr.splice(0, 1);
        }
    }
}
