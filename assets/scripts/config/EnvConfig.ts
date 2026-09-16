import { EPlatform } from "../SDK/PlatformMgr";
import { config } from "./config";
interface EnvConfig {
    url: string;
    remoteResUrl: string;
    platform: EPlatform;
    game_code: string;
}

export const GetEnvConfig = (): EnvConfig => {
    return config as EnvConfig;
};
