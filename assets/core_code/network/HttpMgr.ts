import Logger from "../base/Logger";
import { INetworkTips } from "./NetInterface";

type HttpParams = { [key: string]: unknown };
type CompleteCallback<T> = (response: T) => void;
type ErrorCallback = (error: unknown) => void;

interface IRequestSubscriber {
    completeCallback?: CompleteCallback<unknown>;
    errorCallback?: ErrorCallback;
}

interface IRequestRecord {
    xhr: XMLHttpRequest;
    key: string;
    uri: string;
    subscribers: IRequestSubscriber[];
    settled: boolean;
}

/** 请求事件 */
export enum HttpEvent {
    /** 断网 */
    NO_NETWORK = "http_request_no_network",
    /** 未知错误 */
    UNKNOWN_ERROR = "http_request_unknown_error",
    /** 请求超时 */
    TIMEOUT = "http_request_timout",
    /** 请求取消 */
    CANCELLED = "http_request_cancelled",
    /** 响应解析失败 */
    PARSE_ERROR = "http_response_parse_error",
}

/** HTTP请求 */
class HttpManager {
    /** 服务器地址 */
    private server: string = "http://127.0.0.1/";
    /** 请求超时时间 */
    private timeout: number = 10000;
    /** 请求头Headers协议 */
    private hearders: { [key: string]: string } = {};
    /** 单例模式 */
    private networkTips: INetworkTips | null = null;
    /** 相同请求共享同一个 XHR，订阅者分别且仅完成一次。 */
    private requests = new Map<string, IRequestRecord>();

    private static _inst: HttpManager | null = null;
    public static get inst(): HttpManager {
        if (this._inst == null) {
            this._inst = new HttpManager();
        }
        return this._inst;
    }

    public init(server: string, networkTips: INetworkTips) {
        this.server = server;
        this.networkTips = networkTips;
    }

    public addHeaders(key: string, value: string) {
        this.hearders[key] = value;
    }

    public removeHeaders(key: string) {
        delete this.hearders[key];
    }

    /** HTTP GET请求 */
    public get<T>(
        uri: string,
        params: { [key: string]: string | number | boolean },
        completeCallback?: CompleteCallback<T>,
        errorCallback?: ErrorCallback,
    ) {
        this.sendRequest(uri, params, false, completeCallback, errorCallback);
    }

    /** HTTP POST请求 */
    public post<T>(
        uri: string,
        params: HttpParams,
        completeCallback?: CompleteCallback<T>,
        errorCallback?: ErrorCallback,
    ) {
        this.sendRequest(uri, params, true, completeCallback, errorCallback);
    }

    /** 取消指定接口的所有进行中请求。 */
    public abort(uri: string) {
        const requestUri = this.resolveUrl(uri);
        for (const record of this.requests.values()) {
            if (record.uri === requestUri && !record.settled) {
                record.xhr.abort();
            }
        }
    }

    public abortAll() {
        const records = Array.from(this.requests.values());
        for (const record of records) {
            if (!record.settled) {
                record.xhr.abort();
            }
        }
    }

    public isReady() {}

    private resolveUrl(uri: string): string {
        if (uri.toLocaleLowerCase().indexOf("http") === 0) {
            return uri;
        }
        return this.server + uri;
    }

    /** 获得稳定的查询字符串，相同参数顺序不同也视为同一请求。 */
    private getParamString(params: HttpParams): string {
        const parts: string[] = [];
        for (const name of Object.keys(params).sort()) {
            const value = params[name];
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                const nested = value as HttpParams;
                for (const key of Object.keys(nested).sort()) {
                    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(nested[key]))}`);
                }
            } else {
                parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
            }
        }
        return parts.join("&");
    }

    private sendRequest<T>(
        uri: string,
        params: HttpParams,
        isPost: boolean,
        completeCallback?: CompleteCallback<T>,
        errorCallback?: ErrorCallback,
        responseType?: XMLHttpRequestResponseType,
        isOpenTimeout = true,
        timeout: number = this.timeout,
    ) {
        if (!uri) {
            const error = { event: HttpEvent.UNKNOWN_ERROR, message: "请求地址不能为空" };
            Logger.error("请求地址不能为空");
            errorCallback?.(error);
            return;
        }

        const url = this.resolveUrl(uri);
        const logUri = uri.split(/[?#]/, 1)[0];
        const paramsStr = this.getParamString(params);
        const requestUrl = !isPost && paramsStr ? `${url}${url.indexOf("?") > -1 ? "&" : "?"}${paramsStr}` : url;
        let requestBody = "";
        let requestIdentity = paramsStr;
        try {
            if (isPost) {
                requestBody = JSON.stringify(params);
                requestIdentity = this.stableStringify(params);
            }
        } catch {
            const error = { event: HttpEvent.UNKNOWN_ERROR, message: "请求参数无法序列化" };
            Logger.error("[HttpMgr] request parameters cannot be serialized:", isPost ? "POST" : "GET", logUri);
            errorCallback?.(error);
            return;
        }
        const headerIdentity = this.stableStringify(this.hearders);
        const requestKey = `${isPost ? "POST" : "GET"} ${requestUrl}\n${headerIdentity}\n${requestIdentity}`;
        const subscriber: IRequestSubscriber = {
            completeCallback: completeCallback ? (response) => completeCallback(response as T) : undefined,
            errorCallback,
        };
        const pending = this.requests.get(requestKey);
        if (pending && !pending.settled) {
            pending.subscribers.push(subscriber);
            Logger.log("[HttpMgr] joined pending request:", isPost ? "POST" : "GET", logUri);
            return;
        }

        const xhr = new XMLHttpRequest();
        const record: IRequestRecord = {
            xhr,
            key: requestKey,
            uri: url,
            subscribers: [subscriber],
            settled: false,
        };
        this.requests.set(requestKey, record);

        const fail = (event: HttpEvent, response: string = "", status: number = xhr.status) => {
            const error = { event, status, uri: logUri, code: status, msg: "" };
            Logger.error("[HttpMgr] request failed:", isPost ? "POST" : "GET", logUri, status, event);
            this.networkTips?.showHttpErrorTips(error, response);
            this.settle(record, false, error);
        };

        try {
            xhr.open(isPost ? "POST" : "GET", requestUrl);
            if (responseType) {
                xhr.responseType = responseType;
            }
            xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            for (const key in this.hearders) {
                xhr.setRequestHeader(key, this.hearders[key]);
            }
            if (isOpenTimeout) {
                xhr.timeout = timeout;
            }

            xhr.ontimeout = () => fail(HttpEvent.TIMEOUT);
            xhr.onerror = () => {
                const event =
                    xhr.readyState === 0 || xhr.readyState === 1 || xhr.status === 0
                        ? HttpEvent.NO_NETWORK
                        : HttpEvent.UNKNOWN_ERROR;
                fail(event);
            };
            xhr.onabort = () => fail(HttpEvent.CANCELLED);
            xhr.onreadystatechange = () => {
                if (xhr.readyState !== 4 || record.settled) {
                    return;
                }
                if (xhr.status < 200 || xhr.status >= 300) {
                    fail(xhr.status >= 500 ? HttpEvent.NO_NETWORK : HttpEvent.UNKNOWN_ERROR, xhr.response);
                    return;
                }
                if (responseType === "arraybuffer") {
                    Logger.log("[HttpMgr] request complete:", isPost ? "POST" : "GET", logUri, xhr.status);
                    this.settle(record, true, xhr.response);
                    return;
                }
                try {
                    const response = JSON.parse(xhr.responseText) as unknown;
                    Logger.log("[HttpMgr] request complete:", isPost ? "POST" : "GET", logUri, xhr.status);
                    this.settle(record, true, response);
                } catch {
                    Logger.error("[HttpMgr] response parse failed:", isPost ? "POST" : "GET", logUri);
                    fail(HttpEvent.PARSE_ERROR);
                }
            };

            xhr.send(isPost ? requestBody : undefined);
        } catch {
            fail(HttpEvent.UNKNOWN_ERROR);
        }
    }

    private stableStringify(value: unknown): string {
        if (Array.isArray(value)) {
            return `[${value.map((item) => this.stableStringify(item)).join(",")}]`;
        }
        if (value !== null && typeof value === "object") {
            const record = value as HttpParams;
            return `{${Object.keys(record)
                .sort()
                .map((key) => `${JSON.stringify(key)}:${this.stableStringify(record[key])}`)
                .join(",")}}`;
        }
        return JSON.stringify(value) ?? String(value);
    }

    private settle(record: IRequestRecord, succeeded: boolean, result: unknown) {
        if (record.settled) {
            return;
        }
        record.settled = true;
        this.requests.delete(record.key);
        const subscribers = record.subscribers.splice(0);
        for (const subscriber of subscribers) {
            try {
                if (succeeded) {
                    subscriber.completeCallback?.(result);
                } else {
                    subscriber.errorCallback?.(result);
                }
            } catch {
                Logger.error("[HttpMgr] request callback failed:", record.uri.split(/[?#]/, 1)[0]);
            }
        }
    }
}

export const HttpMgr = HttpManager.inst;
