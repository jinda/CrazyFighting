import { GameUILayers } from "../../scripts/GameUILayers";
import { ModuleDef } from "../../scripts/ModuleDef";
import { UI_Language } from "../../scripts/UIDef";
import { Layout_Language } from "./Layout_Language";
import { i18nMgr, ELanguage, ELanguageKey } from "../../scripts/i18n/i18nMgr";
import { DataMgr } from "../../scripts/DataMgr";
import { Label, Toggle } from "cc";

@egf_class(ModuleDef.EXTRA, UI_Language)
export class UI_Language_Impl extends UI_Language {
  constructor() {
    super("ui_language/UI_Language", GameUILayers.POPUP2, Layout_Language);
  }

  protected onCreated(params?: any): void {
    let layout = this.layout as Layout_Language;
    this.onButtonEvent(layout.btnClose, () => {
      this.close();
    });

    // 映射语言到 Toggle
    const langToToggle = {
      [ELanguage["zh"]]: layout.tgContainer.toggleItems[0],
      [ELanguage["zh-tw"]]: layout.tgContainer.toggleItems[1],
      [ELanguage["en"]]: layout.tgContainer.toggleItems[2],
      [ELanguage["hi-in"]]: layout.tgContainer.toggleItems[3],
      [ELanguage["pt-br"]]: layout.tgContainer.toggleItems[4],
      [ELanguage["es"]]: layout.tgContainer.toggleItems[5],
      [ELanguage["ar"]]: layout.tgContainer.toggleItems[6],
      [ELanguage["ja"]]: layout.tgContainer.toggleItems[7],
    };

    // 初始化选中状态
    const currentLang = i18nMgr.getLanguage();
    Object.keys(ELanguageKey).forEach((lang) => {
      const label = langToToggle[lang]?.getComponentInChildren(Label);
      if (label) {
        langToToggle[lang].node.name = lang;
        label.string = ELanguageKey[lang];
      }
      if (lang === currentLang) {
        langToToggle[lang].isChecked = true;
      }
    });

    // 注册事件
    this.onToggleEvent(layout.tgContainer, this.selectLanguage, this);
  }

  private selectLanguage(toggle: Toggle) {
    const lang = toggle.node.name;
    egf.Logger.log("selectLanguage:", lang);
    i18nMgr.setLanguage(lang);
    egf.AudioMgr.inst.playOneShot("tap");

    // 如果需要持久化到 DataMgr，可以在这里添加
    DataMgr.inst.Setting.language = lang;
    DataMgr.inst.saveSettingData();
  }
}
