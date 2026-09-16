export class URLUtils {
    public static urlParse(url: string): any {
        let params: { [key: string]: any } = {};
        if (!url) {
            return params;
        }
        let name, value;
        let str = url; //取得整个地址栏
        let num = str.indexOf("?");
        str = str.substring(num + 1); //取得所有参数   string.substr(start [, length ]

        let arr = str.split("&"); //各个参数放到数组里
        for (let i = 0; i < arr.length; i++) {
            num = arr[i].indexOf("=");
            if (num > 0) {
                name = arr[i].substring(0, num);
                value = arr[i].substr(num + 1);
                params[name] = value;
            }
        }
        return params;
    }
}
