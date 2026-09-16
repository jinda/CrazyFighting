/** 红点计算函数的类型 */
export type RedDotCalculateFunc = (param?: any) => [boolean, number];

/** 红点配置项结构体 */
export interface RedDotConfigItem {
    parent: string;
    count: number;
    func?: RedDotCalculateFunc;
    param?: any;
    des?: string;
}

export type RedDotConfigTable = { [key: string]: RedDotConfigItem };

export const EVENT_RED_DOT_REFRESH = "event_red_dot_refresh";
