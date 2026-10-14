// import ResMgr from "../Managers/ResMgr";
import { EDITOR_NOT_IN_PREVIEW } from "cc/env";
import * as i18nLabel from "./i18n/i18nLabel";
import * as i18nSprite from "./i18n/i18nSprite";
import { JsonAsset, Label, SpriteFrame, assetManager, isValid, sys } from "cc";
import { ResMgr } from "./ResMgr";

export enum ELanguage {
    en = "en", // 英语
    "zh-cn" = "zh_cn", // 简体中文
    "zh-tw" = "zh_tw", // 繁体中文
    ru = "ru", // 俄语
    fr = "fr", // 法语
    de = "de", // 德语
    ja = "ja", // 日语
    ko = "ko", // 韩语
    es = "es", // 西班牙语
    pt = "pt", // 葡萄牙语
}

export enum ELanguageKey {
    en = "English", // 英语
    zh_cn = "简体中文", // 简体中文
    zh_tw = "繁体中文", // 繁体中文
    ru = "Русский", // 俄语
    fr = "Français", // 法语
    de = "Deutsch", // 德语
    ja = "日本語", // 日语
    ko = "한국어", // 韩语
    es = "Español", // 西班牙语
    pt = "Português", // 葡萄牙语
}

class i18nManager {
    private static _inst: i18nManager | null = null;
    public static get inst(): i18nManager {
        if (this._inst == null) {
            this._inst = new i18nManager();
        }
        return this._inst;
    }

    private _language: ELanguage =
        this.resolveLanguage(sys.languageCode) ?? this.resolveLanguage(sys.language) ?? ELanguage.en; // 当前语言
    private _labelArr: i18nLabel.i18nLabel[] = []; // i18nLabel 列表
    private _labelData: { [key: string]: string } = {}; // 文字配置
    private _spriteArr: i18nSprite.i18nSprite[] = []; // i18nSprite 列表

    private _bundleName: string = "resources"; // 资源包名或远程地址

    /**
     * 设置模块
     */
    public set bundleName(v: string) {
        this._bundleName = v;
    }

    private checkInit() {
        if (!this._language) {
            this.setLanguage(this._language);
        }
    }

    /**
     * 设置语言
     */
    public get language() {
        return this._language;
    }

    private resolveLanguage(language: unknown): ELanguage | null {
        if (typeof language !== "string" || !language.trim()) {
            return null;
        }
        const code = language.trim().toLowerCase().replace(/_/g, "-");
        const parts = code.split("-");
        switch (parts[0]) {
            case "zh":
                return parts.some((part) => ["tw", "hk", "mo", "hant"].includes(part))
                    ? ELanguage["zh-tw"]
                    : ELanguage["zh-cn"];
            case "en":
                return ELanguage.en;
            case "ru":
                return ELanguage.ru;
            case "fr":
                return ELanguage.fr;
            case "de":
                return ELanguage.de;
            case "ja":
                return ELanguage.ja;
            case "ko":
                return ELanguage.ko;
            case "es":
                return ELanguage.es;
            case "pt":
                return ELanguage.pt;
            default:
                return null;
        }
    }

    public setLanguage(language: string) {
        const resolvedLanguage = this.resolveLanguage(language);
        if (language && !resolvedLanguage) {
            egf.Logger.warn("Unsupported language, keeping current language:", language, this._language);
        }
        //首次启动的存档语言为空，也要加载系统语言或默认英文的翻译资源。
        const nextLanguage = resolvedLanguage ?? this._language;
        if (this._language === nextLanguage && Object.keys(this._labelData).length !== 0) {
            return;
        }
        this._language = nextLanguage;
        egf.Logger.log("current language:", this._language);

        this.reloadLabel();
        this.reloadSprite();
    }

    /**
     * 添加或移除 i18nLabel
     */
    public _addOrDelLabel(label: i18nLabel.i18nLabel, isAdd: boolean) {
        if (isAdd) {
            this._labelArr.push(label);
        } else {
            let index = this._labelArr.indexOf(label);
            if (index !== -1) {
                this._labelArr.splice(index, 1);
            }
        }
    }

    public getText(opt: string, params?: string[]): string {
        this.checkInit();
        return this._getLabel(opt, params);
    }

    public _getLabel(opt: string, params?: string[]): string {
        this.checkInit();
        if (!params || params.length === 0) {
            return this._labelData[opt] || opt;
        }
        let str = this._labelData[opt] || opt;
        for (let i = 0; i < params.length; i++) {
            let reg = new RegExp("#" + i, "g");
            str = str.replace(reg, params[i]);
        }
        return str;
    }

    /**
     * 添加或移除 i18nSprite
     */
    public _addOrDelSprite(sprite: i18nSprite.i18nSprite, isAdd: boolean) {
        if (isAdd) {
            this._spriteArr.push(sprite);
        } else {
            let index = this._spriteArr.indexOf(sprite);
            if (index !== -1) {
                this._spriteArr.splice(index, 1);
            }
        }
    }

    public async _getSprite(path: string, cb: (spriteFrame: SpriteFrame) => void) {
        this.checkInit();
        if (!path && path.trim() === "") {
            egf.Logger.error("_getSprite error: path is empty");
            return;
        }
        if (EDITOR_NOT_IN_PREVIEW) {
            // @ts-ignore
            const uuid = await Editor.Message.request(
                "asset-db",
                "query-uuid",
                "db://assets/module_i18n/sprite/" + this._language + "/" + path + ".png/spriteFrame",
            );
            // egf.Logger.log("reloadLabel uuid:", uuid);
            if (!uuid && uuid.trim() === "") {
                egf.Logger.error(
                    "_getSprite error: uuid is empty:",
                    "db://assets/module_i18n/sprite/" + this._language + "/" + path + ".png/spriteFrame",
                );
                return;
            }

            assetManager.loadAny({ uuid: uuid, type: SpriteFrame }, (err: Error, spriteFrame: SpriteFrame) => {
                if (err) {
                    egf.Logger.error("_getSprite error:", err);
                    return;
                } else {
                    cb && cb(spriteFrame);
                }
            });
        } else {
            let fullPath = "sprite/" + this._language + "/" + path + "/spriteFrame";
            if (ResMgr.isRemoteUrl(this._bundleName)) {
                fullPath = this._bundleName + this._language + "/" + path;
            }
            ResMgr.getAsset(this._bundleName, fullPath, cb, SpriteFrame);
        }
    }

    /**
     *
     * @param label 文本组件
     * @param key 翻译的key
     * @param params 翻译的参数
     */
    public setLabelKey(label: Label, key: string, params?: string[]) {
        if (isValid(label)) {
            let i18n = label.getComponent(i18nLabel.i18nLabel);
            if (!i18n) {
                i18n = label.addComponent(i18nLabel.i18nLabel);
            }
            i18n?.init(key, params || []);
        }
    }

    private async reloadLabel() {
        if (EDITOR_NOT_IN_PREVIEW) {
            // @ts-ignore
            const uuid = await Editor.Message.request(
                "asset-db",
                "query-uuid",
                "db://assets/module_i18n/label/" + this._language + ".json",
            );
            // egf.Logger.log("reloadLabel uuid:", uuid);
            if (!uuid && uuid.trim() === "") {
                egf.Logger.error(
                    "reloadLabel error: uuid is empty:",
                    "db://assets/module_i18n/label/" + this._language + ".json",
                );
                return;
            }
            assetManager.loadAny({ uuid: uuid, type: JsonAsset }, (err: Error, data: any) => {
                if (err) {
                    egf.Logger.error("reloadLabel error:", err);
                    this._labelData = {};
                    return;
                } else {
                    this._labelData = data.json;
                }
                for (let one of this._labelArr) {
                    one._resetValue();
                }
            });
        } else {
            egf.Logger.log("reloadLabel:", this._language);
            let path = "label/" + this._language;
            if (ResMgr.isRemoteUrl(this._bundleName)) {
                path = this._bundleName + this._language + ".json";
            }
            ResMgr.getAsset(
                this._bundleName,
                path,
                (data: JsonAsset) => {
                    // egf.Logger.log("reloadLabel:", this.language, data.json);
                    if (data) {
                        this._labelData = data.json as {};
                    }
                    for (let one of this._labelArr) {
                        one._resetValue();
                    }
                },
                JsonAsset,
            );
        }
    }

    private reloadSprite() {
        for (let one of this._spriteArr) {
            one._resetValue();
        }
    }
}

export const i18nMgr = i18nManager.inst;
