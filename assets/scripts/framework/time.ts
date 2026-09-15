import { _decorator } from "cc";
const { ccclass } = _decorator;

@ccclass
export default class Time {

    /**
     * 格式化日期
     * @method formatDate
     * @param {Date} date 日期
     * @param {string} fmt 格式,支持 hh:mm:ss, mm:ss, ss
     *                              hh小时mm分钟或mm分钟
     *                              yy年MM月dd天或MM月dd天或dd天
     *                              dd天hh小时mm分钟
     *                              dd天hh小时mm分钟ss秒
     *                              yyyy-MM-dd或yyyy/MM/dd或yyyy年MM月dd日
     *                              yyyy-MM-dd hh:mm:ss 或 yyyy年MM月dd日 hh时mm分ss秒
     *                              dd天 hh:mm:ss
     */
    public static formatDate (date: Date, fmt: string) {
        const o: any = {
            'M+': date.getMonth() + 1, // 月份
            'd+': date.getDate(), // 日
            'h+': date.getHours(), // 小时
            'm+': date.getMinutes(), // 分
            's+': date.getSeconds(), // 秒
            'q+': Math.floor((date.getMonth() + 3) / 3), // 季度
            'S': date.getMilliseconds(), // 毫秒
        };

        if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (`${date.getFullYear()}`).substr(4 - RegExp.$1.length));
        for (const k in o) { if (new RegExp(`(${k})`).test(fmt)) fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : ((`00${o[k]}`).substr((`${o[k]}`).length))); }
        return fmt;
    }

    public static SECONDS_PER_DAY = 24 * 3600;

    /**
     * 获取天数
     * @param {number} seconds   秒
     * @returns {number}
     * @method getDaysBySeconds
     */
    public static getDaysBySeconds (seconds: number) {
        return Math.floor(seconds / Time.SECONDS_PER_DAY);
    }

    /**
     * 把天数转化成秒
     * @param {number} days
     * @returns {number}
     * @method getSecondsFromDays
     */
    public static getSecondsFromDays (days: number) {
        return days * Time.SECONDS_PER_DAY;
    }

    /**
     * 根据时间戳获取date数据
     * @param {number} time  时间戳
     * @returns {Date} 
     **/
    public static getDateInfo (time: number) {
        return new Date(time);
    }

    /**
     * 获取时间戳（秒）
     * @param isMillisecond 是否返回毫秒时间戳
     * @method getTimeStamp
     */
    public static getTimeStamp(isMillisecond: boolean) {
        if (isMillisecond) {
            return (new Date()).getTime();
        }
        return Math.floor((new Date()).getTime() / 1000);
    }

    /**
     * 时间戳转Date对象
     * @param {string | number} timeStamp 时间戳
     * @param {boolean} isMillisecond 是否是毫秒
     * @returns {Date}
     * @method convertToDate
     */
    public static convertToDate (timeStamp: string|number, isMillisecond: boolean) {
        timeStamp = Number(timeStamp);
        timeStamp = Math.floor(timeStamp);

        if (!isMillisecond) {
            timeStamp *= 1000;
        }

        return new Date(timeStamp);
    }

    /**
     * 格式化时间 1st March,2019
     * @param date 时间
     * @method formatDayToEnglish
     */
    public static formatDayToEnglish (date: Date) {
        let month;
        let day;
        switch (date.getMonth()) {
            case 0:
                month = 'January';
                break;
            case 1:
                month = ' February';
                break;
            case 2:
                month = 'March';
                break;
            case 3:
                month = 'April';
                break;
            case 4:
                month = 'May';
                break;
            case 5:
                month = 'June';
                break;
            case 6:
                month = 'July';
                break;
            case 7:
                month = 'August';
                break;
            case 8:
                month = 'September';
                break;
            case 9:
                month = 'October';
                break;
            case 10:
                month = 'November';
                break;
            case 11:
                month = 'December';
                break;
            default:
        }

        if (date.getDate() === 1 || date.getDate() === 11 || date.getDate() === 21 || date.getDate() === 31) {
            day = `${date.getDate()}st`;
        } else if (date.getDate() === 2 || date.getDate() === 22) {
            day = `${date.getDate()}nd`;
        } else if (date.getDate() === 3 || date.getDate() === 23) {
            day = `${date.getDate()}rd`;
        } else {
            day = `${date.getDate()}th`;
        }
        let r = '';
        r += `${day} `;
        r += `${month},`;
        r += `${date.getFullYear()}`;
        return r;
    }

    /**
     * 获取指定日期在当年的第几周
     * @param {Date} dt
     * @returns {number} 第几周
     * @method getWeekOfYear
     */
    public static getWeekOfYear(dt = new Date()) {
        const d1 = dt;
        const d2 = new Date(dt.getFullYear(), 0, 1);
        const d = Math.round((d1.getTime() - d2.getTime()) / 86400000);
        return Math.ceil((d + ((d2.getDay() + 1) - 1)) / 7);
    }

    /**
     * 获取两个时间之间相差多少秒
     * @param {Date} startDate
     * @param {Date} endDate
     * @method getInervalSecond
     */
    public static getInervalSecond(startDate: Date, endDate: Date) {
        const time = endDate.getTime() - startDate.getTime();
        const s = parseInt((time / 1000).toString());
        return s;
    }

    /**
     * 获取两个时间之间相差多少小时
     * @param {Date} startDate
     * @param {Date} endDate
     * @method getInervalHour
     */
    public static getInervalHour(startDate: Date, endDate: Date) {
        const ms = endDate.getTime() - startDate.getTime();
        if (ms < 0) return 0;
        return Math.floor(ms / 1000 / 3600);
    }

    /**
     * 获取两个时间之间相差多少天
     * @param {Date} startDate
     * @param {Date} endDate
     * @method getInervalDay
     */
    public static getInervalDay(startDate: Date, endDate: Date) {
        // 时间差的毫秒数
        const time = endDate.getTime() - startDate.getTime();
        // 计算出相差天数
        const days = Math.floor(time / (24 * 3600 * 1000));
        return days;
    }

    /**
     * 是否是今天
     * @param time 时间戳
     * @param isMillisecond 是否是毫秒时间戳
     * @method isToday
     */
    public static isToday(time: number, isMillisecond: boolean) {
        const date = new Date(time * (isMillisecond ? 1 : 1000));
        const today = new Date();
        // 如果是今天注册
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    /**
     * 判断当前时间是否在有效时间内
     * @param {String|Number} start 起始时间。带有时区信息
     * @param {String|Number} end 结束时间。带有时区信息
     * @method isNowValid
     */
    public static isNowValid (start: string|number, end: string|number) {
        const startTime = new Date(start);
        const endTime = new Date(end);
        let result = false;

        if (`${startTime.getDate()}` !== 'NaN' && `${endTime.getDate()}` !== 'NaN') {
            const curDate = new Date();
            result = curDate < endTime && curDate > startTime;
        }
        return result;
    }

    /**
     * 判断是否是新的一天
     * @param {Date} date
     * @returns {boolean}
     * @method isNewDay
     */
    public static isNewDay (date: Date) {
        const oldDate = new Date(date);
        const curDate = new Date();

        const oldYear = oldDate.getFullYear();
        const oldMonth = oldDate.getMonth();
        const oldDay = oldDate.getDate();
        const curYear = curDate.getFullYear();
        const curMonth = curDate.getMonth();
        const curDay = curDate.getDate();

        if (curYear > oldYear) {
            return true;
        }
        if (curMonth > oldMonth) {
            return true;
        }
        if (curDay > oldDay) {
            return true;
        }
        return false;
    }
}
