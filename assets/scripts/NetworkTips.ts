import { JsonAsset } from "cc";
import { GetEnvConfig } from "./config/EnvConfig";
import { LocalDataMgr } from "./LocalDataMgr";
import { ModuleDef } from "./ModuleDef";
import { UI_CommonTips } from "./UIDef";

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
                            egf.EventMgr.emit("EVT_FETCH_AND_UPDATE_USER_INFO");
                        }
                    },
                });
            }
        }, 3000);
    }

    showServerErrorTips(errorMsg: unknown): void {
        const error = errorMsg as Proto.pb.ErrorMsg;
        egf.UIWaiting.hide();

        if (!error) {
            egf.Logger.error(`[NetworkTips - On Error]: Invalid Error.`);
        } else {
            egf.Logger.error(`[NetworkTips - On Error]: ${JSON.stringify(error)}`);
            this.filterErrorBizCode(error);
        }
    }

    filterErrorBizCode(error: Proto.pb.ErrorMsg) {
        // Check if it is log in errors
        const { code, bizCode } = error;
        if (code !== Proto.pb.RetCode.ERR_BUSINESS) {
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
        return new Promise<boolean>((resolve, reject) => {
            egf.ResMgr.inst.getAsset(
                ModuleDef.BASIC,
                resUrl,
                (jsonAsset: JsonAsset) => {
                    if (!jsonAsset) {
                        egf.Logger.error(`${resUrl} not found!`);
                        resolve(false); // 假设资源未找到时，返回 false 表示不在维护状态
                    } else {
                        // 根据 jsonAsset 的内容判断是否在维护状态，并返回相应的布尔值
                        const maintenanceConfig = jsonAsset.json;
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
                            resolve(false); // 假设资源未找到时，返回 false 表示不在维护状态
                        }
                    }
                },
                (error: Error) => {
                    egf.Logger.error(`Error fetching ${resUrl}:`, error);
                    resolve(false); // 出现错误时，也返回 false 表示不在维护状态
                },
            );
        });
    }

    showHttpErrorTips(data: { event: egf.HttpEvent; code: number; msg: string }): void {
        let tipsStr = "";
        switch (data.event) {
            case egf.HttpEvent.NO_NETWORK:
                tipsStr = "SYS_NETWORK_UNAVAILABLE";
                break;
            case egf.HttpEvent.UNKNOWN_ERROR:
                tipsStr = "SYS_LOST_CONNECTION";
                break;
            case egf.HttpEvent.TIMEOUT:
                tipsStr = "SYS_NETWORK_UNAVAILABLE";
                break;
            default:
                tipsStr = data.msg || `unknown error code:(${data.code})`;
                break;
        }

        egf.UIMgr.showUI(UI_CommonTips, null, this, {
            content: egf.i18nMgr.getText(tipsStr),
            callback: (ok: boolean) => {
                if (ok && egf.NetMgr.isWorking()) {
                    egf.UIMgr.closeUI(UI_CommonTips);
                    egf.EventMgr.emit("EVT_FETCH_AND_UPDATE_USER_INFO");
                }
            },
        });
    }
}
