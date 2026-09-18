import { ModuleDef } from "./ModuleDef";

export class SceneDef {
    public static START = { name: "start" };
    public static GAME = { name: "game", bundle: ModuleDef.GAME };
}
