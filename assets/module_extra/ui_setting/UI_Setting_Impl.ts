import { randomRangeInt, Toggle } from "cc";
import { GameUILayers } from "../../scripts/GameUILayers";
import { GameMode, ModuleDef } from "../../scripts/ModuleDef";
import { UI_AwardStamina, UI_Language, UI_Setting } from "../../scripts/UIDef";
import { Layout_Setting } from "./Layout_Setting";
import { DataMgr } from "../../scripts/DataMgr";
import { SceneDef, SceneUtil } from "../../scripts/SceneDef";
import { ELanguageKey, i18nMgr } from "../../scripts/i18n/i18nMgr";
import { EPlatform, PlatformMgr } from "../../scripts/SDK/PlatformMgr";

@egf_class(ModuleDef.EXTRA, UI_Setting)
export class UI_Setting_Impl extends UI_Setting {
  constructor() {
    super("ui_setting/UI_Setting", GameUILayers.POPUP2, Layout_Setting);
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
    this.onButtonEvent(layout.btnLanguage, this.clickLanguage, this);

    let Setting = DataMgr.inst.Setting;
    layout.tgMusic.isChecked = Setting.musicVolume == 1 ? true : false;
    layout.tgEffect.isChecked = Setting.soundVolume == 1 ? true : false;
    layout.tgShake.isChecked = Setting.shakeVolume == 1 ? true : false;

    this.onToggleEvent(layout.tgMusic, this.onMusic, this);
    this.onToggleEvent(layout.tgEffect, this.onEffect, this);
    this.onToggleEvent(layout.tgShake, this.onShake, this);

    params = params || {};
    layout.btnMenu.node.active = params.bGame;
    layout.btnRestart.node.active = params.bGame;
    layout.btnContinue.node.active = params.bGame;

    layout.labelVer.string = egf.Utils.format(
      i18nMgr._getLabel("版本：%s"),
      DataMgr.inst.gameVersion,
    );

    egf.Logger.log(
      "Setting showInterstitialAd:",
      PlatformMgr.inst.platform,
      Math.random(),
      DataMgr.inst.platformCfg?.setting_clk_percent,
    );
    if (PlatformMgr.inst.platform == EPlatform.Android) {
      if (
        Math.random() < (DataMgr.inst.platformCfg?.setting_clk_percent ?? 0.5)
      ) {
        PlatformMgr.inst.showInterstitialAd(null, null);
      }
    } else if (randomRangeInt(0, 2) == 0) {
      PlatformMgr.inst.showInterstitialAd(null, null);
    }

    const land = DataMgr.inst.Setting.language;
    layout.labelLanguage.string = ELanguageKey[land];
    egf.EventDispatcher.inst.emit("game_pause");
  }
  protected onDispose(): void {
    egf.EventDispatcher.inst.emit("game_resume");
  }

  protected onMusic(toggle: Toggle): void {
    let volume = toggle.isChecked ? 1 : 0;
    egf.Logger.log("onMusic:", volume);
    egf.AudioMgr.inst.musicVolume = volume;
    DataMgr.inst.Setting.musicVolume = volume;
    DataMgr.inst.saveSettingData();
    egf.AudioMgr.inst.playOneShot("tap");
  }
  protected onEffect(toggle: Toggle): void {
    let volume = toggle.isChecked ? 1 : 0;
    egf.AudioMgr.inst.soundVolume = volume;
    DataMgr.inst.Setting.soundVolume = volume;
    DataMgr.inst.saveSettingData();
    egf.AudioMgr.inst.playOneShot("tap");
  }
  protected onShake(toggle: Toggle): void {
    DataMgr.inst.Setting.shakeVolume = toggle.isChecked ? 1 : 0;
    DataMgr.inst.saveSettingData();
    egf.AudioMgr.inst.playOneShot("tap");
  }

  protected clickMenu(): void {
    egf.AudioMgr.inst.playOneShot("tap");
    SceneUtil.loadScene(SceneDef.MAIN_MENU);
  }
  protected clickRestart(): void {
    egf.AudioMgr.inst.playOneShot("tap");
    // DataMgr.inst.DataStorage.level = 1;
    if (!DataMgr.inst.tryConsumeStamina()) {
      egf.UIMgr.inst.showUI(UI_AwardStamina);
      return;
    }
    if (DataMgr.inst.gameMode == GameMode.SortFruits) {
      SceneUtil.loadScene(SceneDef.SORTFRUITS_GAME);
    } else {
      SceneUtil.loadScene(SceneDef.ARROW_GAME);
    }
  }
  protected clickContinue(): void {
    egf.AudioMgr.inst.playOneShot("tap");
    this.close();
  }

  protected clickLanguage(): void {
    egf.AudioMgr.inst.playOneShot("tap");
    egf.UIMgr.inst.showUI(UI_Language);
    this.close();
  }
}
