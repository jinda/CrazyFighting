// import ResMgr from "../Managers/ResMgr";
import { EDITOR, EDITOR_NOT_IN_PREVIEW, PREVIEW } from "cc/env";
import * as i18nLabel from "./i18n/i18nLabel";
import * as i18nSprite from "./i18n/i18nSprite";
import { Asset, JsonAsset, Label, SpriteFrame, assetManager, isValid } from "cc";
import ResMgr from "./ResMgr";

export enum ELanguage {
    zh = "zh_cn", // 简体中文
    "zh-tw" = "zh_tw", // 繁体中文
    en = "en_us", // 英文
    "hi-in" = "hi_in", // 印地语
    "pt-br" = "pt_br", // 葡萄牙语
    "es-es" = "es_es", // 西班牙语
    "ar-sa" = "ar_sa", // 阿拉伯语
    "ja-jp" = "ja_jp", // 日语
}

export enum ELanguageKey {
    zh_cn = "简体中文", // 简体中文 (Simplified Chinese)
    zh_tw = "繁體中文", // 繁体中文 (Traditional Chinese)
    en_us = "English", // 英文 (English)
    hi_in = "हिन्दी", // 印地语 (Hindi)
    pt_br = "Português", // 葡萄牙语 (Portuguese)
    es_es = "Español", // 西班牙语 (Spanish)
    ar_sa = "العربية", // 阿拉伯语 (Arabic)
    ja_jp = "日本語", // 日语 (Japanese)
}

class i18nManager {
    private static _inst: i18nManager;
    public static get inst(): i18nManager {
        if (this._inst == null) {
            this._inst = new i18nManager();
        }
        return this._inst;
    }

    private _language = "en_us"; // 当前语言
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
            this.setLanguage("en_us");
        }
    }

    /**
     * 设置语言
     */
    public get language() {
        return this._language;
    }

    public isRussian() {
        return this._language === "ru_ru";
    }

    public setLanguage(language: string) {
        if (this._language === language && Object.keys(this._labelData).length !== 0) {
            return;
        }
        this._language = language || this._language;
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
            if (ResMgr.inst.isRemoteUrl(this._bundleName)) {
                fullPath = this._bundleName + this._language + "/" + path;
            }
            ResMgr.inst.getAsset(this._bundleName, fullPath, cb, SpriteFrame);
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
            if (ResMgr.inst.isRemoteUrl(this._bundleName)) {
                path = this._bundleName + this._language + ".json";
            }
            ResMgr.inst.getAsset(
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
