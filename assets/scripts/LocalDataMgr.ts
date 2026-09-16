import { sys } from "cc";
import CryptoTS from "crypto-ts";
const { AES } = CryptoTS;

interface IGameInfo {
    deviceID: string;
    hasLoggedIn?: boolean; // 是否已经登录过
}

interface ISetting {
    musicVolume: number;
    soundVolume: number;
    language: string;
    shakeSwith: boolean;
}

const AES_KEY = "eeffaif19822sf11156ff734fsefa9f0bb";
class LocalDataManager {
    private static _inst: LocalDataManager;
    public static get inst(): LocalDataManager {
        if (this._inst == null) {
            this._inst = new LocalDataManager();
        }
        return this._inst;
    }

    private SettingStr = "CrazyFightSettingConfig";
    private GameInfoStr = "CrazyFightGameInfoConfig";

    private _setting: ISetting = {
        musicVolume: 1,
        soundVolume: 1,
        language: "",
        shakeSwith: true,
    }; // 设置

    private _gameInfo: IGameInfo = {
        deviceID: "",
    };

    public guideStep: number = 0;

    public get Setting(): ISetting {
        return this._setting;
    }

    public get GameInfo(): IGameInfo {
        return this._gameInfo;
    }

    public loadData(id: number): void {
        this.SettingStr += id;
        this.GameInfoStr += id;

        this.loadGameInfoData();
        this.loadSettingData();
    }

    private loadGameInfoData() {
        const encryptStr = sys.localStorage.getItem(this.GameInfoStr);
        if (encryptStr) {
            try {
                const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
                this._gameInfo = egf.SafeJSON.parse(decryptStr) as IGameInfo;
            } catch (error) {
                egf.Logger.error("Failed to load and parse gameinfo:", error);
            }
        }
    }

    private loadSettingData() {
        const encryptStr = sys.localStorage.getItem(this.SettingStr);
        if (encryptStr) {
            try {
                const decryptStr = AES.decrypt(encryptStr, AES_KEY).toString(CryptoTS.enc.Utf8);
                this._setting = egf.SafeJSON.parse(decryptStr) as ISetting;

                egf.AudioMgr.musicVolume = this._setting.musicVolume;
                egf.AudioMgr.soundVolume = this._setting.soundVolume;
            } catch (error) {
                egf.Logger.error("Failed to load and parse settings:", error);
            }
        }
    }

    public saveGameInfoData() {
        const encryptStr = AES.encrypt(egf.SafeJSON.stringify(this.GameInfo), AES_KEY).toString();
        sys.localStorage.setItem(this.GameInfoStr, encryptStr);
    }

    public saveSettingData() {
        const encryptStr = AES.encrypt(egf.SafeJSON.stringify(this.Setting), AES_KEY).toString();
        sys.localStorage.setItem(this.SettingStr, encryptStr);
    }
}

export const LocalDataMgr = LocalDataManager.inst;
