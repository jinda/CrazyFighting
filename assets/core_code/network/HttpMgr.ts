import Logger from "../base/Logger";
import { INetworkTips } from "./NetInterface";

var urls: any = {}; // 当前请求地址集合
var reqparams: any = {}; // 请求参数

/** 请求事件 */
export enum HttpEvent {
    /** 断网 */
    NO_NETWORK = "http_request_no_network",
    /** 未知错误 */
    UNKNOWN_ERROR = "http_request_unknown_error",
    /** 请求超时 */
    TIMEOUT = "http_request_timout",
}

/** HTTP请求 */
class HttpManager {
    /** 服务器地址 */
    public server: string = "http://127.0.0.1/";
    /** 请求超时时间 */
    private timeout: number = 10000;
    /** 请求头Headers协议 */
    private hearders: { [key: string]: string } = {};
    /** 单例模式 */
    private networkTips: INetworkTips | null = null;

    private static _inst: HttpManager;
    public static get inst(): HttpManager {
        if (this._inst == null) {
            this._inst = new HttpManager();
        }
        return this._inst;
    }

    public addHeaders(key: string, value: string) {
        this.hearders[key] = value;
    }
    /**
     * HTTP GET请求
     * @param uri                  协议名
     * @param params               查询参数key-value
     * @param completeCallback      请求完整回调方法
     * @param errorCallback         请求失败回调方法
     * @example
    var complete = function(response){
        egf.Logger.log(response);
    }
    var error = function(response){
        egf.Logger.log(response);
    }
    HttpMgr.inst.get(uri, complete, error);
     */
    public get(
        uri: string,
        params: { [key: string]: string | number | boolean },
        completeCallback?: Function,
        errorCallback?: Function,
    ) {
        this.sendRequest(uri, params, false, completeCallback, errorCallback);
    }

    /**
     * HTTP POST请求
     * @param uri                   协议名
     * @param params                查询参数
     * @param completeCallback      请求完整回调方法
     * @param errorCallback         请求失败回调方法
     * @example
    var param = '{"LoginCode":"donggang_dev","Password":"e10adc3949ba59abbe56e057f20f883e"}'
    var complete = function(response){
        var jsonData = JSON.parse(response);
        var data = JSON.parse(jsonData.Data);
        egf.Logger.log(data.Id);
    }
    var error = function(response){
        egf.Logger.log(response);
    }
    HttpMgr.inst.post(uri, param, complete, error);
     */
    public post(uri: string, params: any, completeCallback?: Function, errorCallback?: Function) {
        this.sendRequest(uri, params, true, completeCallback, errorCallback);
    }

    /** 取消请求中的请求 */
    abort(uri: string) {
        var xhr = urls[this.server + uri];
        if (xhr) {
            xhr.abort();
        }
    }

    abortAll() {
        for (var key in urls) {
            var xhr = urls[key];
            if (xhr) {
                xhr.abort();
            }
        }
        urls = {};
        reqparams = {};
    }

    /**
     * 获得字符串形式的参数
     */
    private getParamString(params: any) {
        var result = "";
        for (var name in params) {
            let data = params[name];
            if (data instanceof Object) {
                for (var key in data) result += `${key}=${data[key]}&`;
            } else {
                result += `${name}=${data}&`;
            }
        }

        return result.substring(0, result.length - 1);
    }

    /**
     * Http请求
     * @param name(string)              请求地址
     * @param params(JSON)              请求参数
     * @param isPost(boolen)            是否为POST方式
     * @param callback(function)        请求成功回调
     * @param errorCallback(function)   请求失败回调
     * @param responseType(string)      响应类型
     */
    private sendRequest(
        uri: string,
        params: any,
        isPost: boolean,
        completeCallback?: Function,
        errorCallback?: Function,
        responseType?: string,
        isOpenTimeout = true,
        timeout: number = this.timeout,
    ) {
        if (uri == null || uri == "") {
            Logger.error("请求地址不能为空");
            return;
        }

        var url: string, newUrl: string, paramsStr: string;
        if (uri.toLocaleLowerCase().indexOf("http") == 0) {
            url = uri;
        } else {
            url = this.server + uri;
        }

        if (params) {
            paramsStr = this.getParamString(params);
            if (url.indexOf("?") > -1) newUrl = url + "&" + paramsStr;
            else newUrl = url + "?" + paramsStr;
        } else {
            newUrl = url;
        }

        if (urls[newUrl] != null && reqparams[newUrl] == paramsStr!) {
            Logger.warn(`地址【${url}】已正在请求中，不能重复请求`);
            return;
        }

        Logger.log("数据请求 params:", uri, params);

        var xhr = new XMLHttpRequest();

        // 防重复请求功能
        urls[newUrl] = xhr;
        reqparams[newUrl] = paramsStr!;

        if (isPost) {
            xhr.open("POST", url);
        } else {
            xhr.open("GET", newUrl);
        }

        // xhr.setRequestHeader(
        //   "Content-Type",
        //   "application/x-www-form-urlencoded;charset=utf-8"
        // );
        xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        for (const key in this.hearders) {
            xhr.setRequestHeader(key, this.hearders[key]);
        }

        var data: any = {};
        data.url = url;
        data.params = params;

        // 请求超时
        if (isOpenTimeout) {
            xhr.timeout = timeout;
            xhr.ontimeout = () => {
                this.deleteCache(newUrl);

                data.event = HttpEvent.TIMEOUT;

                this.networkTips?.showHttpErrorTips(data);
                errorCallback && errorCallback(data);
            };
        }

        xhr.onloadend = (a) => {
            if (xhr.status == 500) {
                this.deleteCache(newUrl);
                data.event = HttpEvent.NO_NETWORK; // 断网
                this.networkTips?.showHttpErrorTips(data);
                errorCallback && errorCallback(data);
            }
        };

        xhr.onerror = () => {
            egf.Logger.error("onerror:", xhr.readyState);
            this.deleteCache(newUrl);
            if (xhr.readyState == 0 || xhr.readyState == 1 || xhr.status == 0) {
                data.event = HttpEvent.NO_NETWORK; // 断网
            } else {
                data.event = HttpEvent.UNKNOWN_ERROR; // 未知错误
            }
            this.networkTips?.showHttpErrorTips(data);
            errorCallback && errorCallback(data);
        };

        xhr.onreadystatechange = () => {
            if (xhr.readyState != 4) return;

            this.deleteCache(newUrl);

            if (xhr.status >= 200 && xhr.status < 300) {
                if (completeCallback) {
                    if (responseType == "arraybuffer") {
                        Logger.log("数据返回 uri:", uri, " data:", xhr.response);
                        // 加载非文本格式
                        xhr.responseType = responseType;
                        completeCallback(xhr.response);
                    } else {
                        // 加载JSON格式
                        var data: any = JSON.parse(xhr.response);
                        Logger.log("数据返回 uri:", uri, " data:", data);
                        if (data.code != null) {
                            /** 服务器错误码处理 */
                            if (data.code == 0) {
                                completeCallback(data.data);
                            } else {
                                this.networkTips?.showHttpErrorTips(data);
                                errorCallback && errorCallback(data);
                            }
                        } else {
                            completeCallback(data);
                        }
                    }
                }
            } else {
                // 处理非200状态码
                Logger.error("HTTP请求失败，状态码:", xhr.status, "响应:", xhr.response);
                const data = {
                    status: xhr.status,
                    response: xhr.response,
                };

                errorCallback && errorCallback(data);
            }
        };

        if (params == null || params == "") {
            xhr.send();
        } else {
            // xhr.send(paramsStr!);                // 根据服务器接受数据方式做选择
            xhr.send(JSON.stringify(params));
        }
    }

    private deleteCache(url: string) {
        delete urls[url];
        delete reqparams[url];
    }
}

export const HttpMgr = HttpManager.inst;
