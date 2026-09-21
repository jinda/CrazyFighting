import { randomRangeInt, Toggle } from "cc";
import { ModuleDef } from "../../scripts/ModuleDef";
import { UI_Language, UI_Setting } from "../../scripts/UIDef";
import { Layout_Setting } from "./Layout_Setting";
import { PlatformMgr } from "../../scripts/SDK/PlatformMgr";
import { LocalDataMgr } from "../../scripts/LocalDataMgr";
import { GetEnvConfig } from "../../scripts/config/EnvConfig";

@egf_class(ModuleDef.EXTRA, UI_Setting)
export class UI_Setting_Impl extends UI_Setting {
    constructor() {
        super("ui_setting/UI_Setting", egf.UILayers.POPUP2, Layout_Setting);
    }

    public getRes(): [] {
        return [];
    }

    protected onCreated(params?: any): void {
        let layout = this.layout as Layout_Setting;
        this.onButtonEvent(layout.btnClose, () => {
            this.close();
        });
        // egf.Logger.log("Setting onCreated:", params, this, layout);
        this.onButtonEvent(layout.btnMenu, this.clickMenu, this);
        this.onButtonEvent(layout.btnRestart, this.clickRestart, this);
        this.onButtonEvent(layout.btnContinue, this.clickContinue, this);

        let Setting = LocalDataMgr.Setting;
        layout.tgMusic.isChecked = Setting.musicVolume == 1 ? true : false;
        layout.tgEffect.isChecked = Setting.soundVolume == 1 ? true : false;
        layout.tgShake.isChecked = Setting.shakeSwith == 1 ? true : false;

        this.onToggleEvent(layout.tgMusic, this.onMusic, this);
        this.onToggleEvent(layout.tgEffect, this.onEffect, this);
        this.onToggleEvent(layout.tgShake, this.onShake, this);

        params = params || {};
        layout.nodeBottom.active = params.bGame;

        const { version } = GetEnvConfig();
        layout.labelVer.string = egf.i18nMgr.getText("版本") + ":" + version;

        const langSelects: any = [];
        Object.keys(egf.ELanguageKey).forEach((lang) => {
            langSelects.push({
                name1: egf.ELanguageKey[lang as keyof typeof egf.ELanguageKey],
                selectId: lang,
            });
        });
        layout.languageSelect.showInfo(egf.i18nMgr.language, langSelects, (selectId) => {
            egf.AudioMgr.playOneShot("tap");
            LocalDataMgr.Setting.language = selectId as string;
            egf.i18nMgr.setLanguage(selectId as string);
            LocalDataMgr.saveSettingData();
        });
        if (randomRangeInt(0, 2) == 0) {
            PlatformMgr.showInterstitialAd();
        }

        egf.EventMgr.emit("GamePause");
    }
    protected onDispose(): void {
        egf.EventMgr.emit("GameResume");
    }

    protected onMusic(toggle: Toggle): void {
        egf.AudioMgr.playOneShot("tap");
        let volume = toggle.isChecked ? 1 : 0;
        egf.Logger.log("onMusic:", volume);
        egf.AudioMgr.musicVolume = volume;
        LocalDataMgr.Setting.musicVolume = volume;
        LocalDataMgr.saveSettingData();
    }
    protected onEffect(toggle: Toggle): void {
        egf.AudioMgr.playOneShot("tap");
        let volume = toggle.isChecked ? 1 : 0;
        egf.AudioMgr.soundVolume = volume;
        LocalDataMgr.Setting.soundVolume = volume;
        LocalDataMgr.saveSettingData();
    }
    protected onShake(toggle: Toggle): void {
        egf.AudioMgr.playOneShot("tap");
        LocalDataMgr.Setting.shakeSwith = toggle.isChecked ? 1 : 0;
        LocalDataMgr.saveSettingData();
    }

    protected clickMenu(): void {
        egf.AudioMgr.playOneShot("tap");
    }
    protected clickRestart(): void {
        egf.AudioMgr.playOneShot("tap");
    }
    protected clickContinue(): void {
        egf.AudioMgr.playOneShot("tap");
        this.close();
    }

    protected clickLanguage(): void {
        egf.AudioMgr.playOneShot("tap");
        egf.UIMgr.showUI(UI_Language);
        this.close();
    }
}
