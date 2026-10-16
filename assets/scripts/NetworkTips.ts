import { assetManager, director, sys } from "cc";
import { GetEnvConfig } from "./config/EnvConfig";
import { LocalDataMgr } from "./LocalDataMgr";
import { UI_CommonTips } from "./UIDef";
import { EApiErrcode } from "./apiInterface";
import { SceneDef } from "./SceneDef";
import { ClientApi } from "./ClientApi";

export class NetworkTips implements egf.INetworkTips {
    connectTips(isShow: boolean): void {
        if (isShow) {
            egf.UIWaiting.show("SYS_CONNECTING");
        } else {
            egf.UIWaiting.hide();
        }
    }

    reconnectTips(isShow: boolean): void {
        if (isShow) {
            egf.UIWaiting.show("SYS_RECONNECTING");
        } else {
            egf.UIWaiting.hide();
        }
    }

    requestTips(isShow: boolean): void {
        if (isShow) {
            egf.UIWaiting.show("SYS_REQUESTING");
        } else {
            egf.UIWaiting.hide();
        }
    }
    showErrorTips(code: number): void {
        setTimeout(async () => {
            const bUpdating = await this.checkMaintenance();
            if (bUpdating) {
                egf.NetMgr.close();
                return;
            }
            if (!egf.NetMgr.isWorking()) {
                egf.UIWaiting.hide();
                egf.UIMgr.showUI(UI_CommonTips, null, this, {
                    content: egf.i18nMgr.getText("SYS_LOST_CONNECTION"),
                    callback: (ok: boolean) => {
                        if (ok && egf.NetMgr.isWorking()) {
                            egf.UIMgr.closeUI(UI_CommonTips);
                        }
                    },
                });
            }
        }, 3000);
    }

    showServerErrorTips(errorMsg: unknown): void {
        //TODO: 原工程使用 Proto.pb.ErrorMsg（protobuf 定义未随本项目迁移），先按结构类型处理，接入协议后替换
        const error = errorMsg as { code?: number; bizCode?: string } | null;
        egf.UIWaiting.hide();

        if (!error) {
            egf.Logger.error(`[NetworkTips - On Error]: Invalid Error.`);
        } else {
            egf.Logger.error(`[NetworkTips - On Error]: ${JSON.stringify(error)}`);
            this.filterErrorBizCode(error);
        }
    }

    filterErrorBizCode(error: { code?: number; bizCode?: string }) {
        //TODO: 原工程判定 Proto.pb.RetCode.ERR_BUSINESS；协议未迁移前以“业务错误必带 bizCode 文案 key”等价处理
        if (!error.bizCode) {
            return;
        }
        egf.UIMgr.showUI(UI_CommonTips, undefined, this, {
            content: egf.i18nMgr.getText(error.bizCode),
        });

        return;
    }

    async checkMaintenance(): Promise<boolean> {
        const { remoteResUrl } = GetEnvConfig();
        const resUrl = remoteResUrl + `/maintenance/maintenance.json` + `?v=${Date.now()}`;
        return new Promise<boolean>((resolve) => {
            //维护配置是远程 json（不在任何 bundle 内），原工程的 ResMgr/ModuleDef.BASIC 用法无法加载，改用 loadRemote 直连
            assetManager.loadRemote(resUrl, (err: Error | null, data: unknown) => {
                if (err || !data) {
                    egf.Logger.error(`${resUrl} not found!`, err);
                    resolve(false); // 假设资源未找到时，返回 false 表示不在维护状态
                    return;
                }
                // 根据 json 内容判断是否在维护状态，并返回相应的布尔值
                const maintenanceConfig = typeof data === "string" ? JSON.parse(data) : (data as any);
                if (maintenanceConfig && maintenanceConfig.isUpdating) {
                    const content = maintenanceConfig.content[LocalDataMgr.Setting.language] || {
                        title: "Maintenance",
                        text: "Token War is currently under maintenance. Please check back later!",
                    };
                    egf.UIMgr.showUI(UI_CommonTips, undefined, this, {
                        title: content.title,
                        content: content.text,
                        okTxt: "TXT_Exit",
                        callback: (ok: boolean) => {
                            ok && window.location.reload();
                        },
                    });
                    resolve(true);
                } else {
                    resolve(false); // 未开启维护时，返回 false 表示不在维护状态
                }
            });
        });
    }

    showHttpErrorTips(data: { event: egf.HttpEvent; code: number; msg: string }, response: string): void {
        let tipsStr = "";
        switch (data.event) {
            case egf.HttpEvent.NO_NETWORK:
                tipsStr = "网络连接不可用";
                break;
            case egf.HttpEvent.UNKNOWN_ERROR:
                tipsStr = "网络失去连接";
                break;
            case egf.HttpEvent.TIMEOUT:
                tipsStr = "网络连接不好";
                break;
            default:
                tipsStr = data.msg || `unknown error code:(${data.code})`;
                break;
        }
        egf.Logger.error("showHttpErrorTips:", data, response);
        const res = egf.SafeJSON.parse(response);
        if (res.errcode == EApiErrcode.SessionReplaced) {
            egf.UIMgr.showUI(UI_CommonTips, null, this, {
                content: egf.i18nMgr.getText(res.errmsg),
                callback: (ok: boolean) => {
                    if (ok) {
                        egf.UIMgr.closeAll();
                        ClientApi.inst.setToken("");
                        LocalDataMgr.removeLocalGameInfo();
                        setTimeout(() => {
                            director.loadScene(SceneDef.START.name);
                        }, 500);
                    }
                },
            });
        }
    }
}
