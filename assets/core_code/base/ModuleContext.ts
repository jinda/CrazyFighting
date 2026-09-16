const PROP_MODULE = "__module__name__";
const PROP_IMPL_CLASS = "__impl__class__";

let defaultModule = "resources";

export class ModuleContext {
    public static setDefaultModule(moduleName: any) {
        defaultModule = moduleName;
    }

    public static getDefaultModule() {
        return defaultModule;
    }

    public static attachClassModule(cls: any, moduleName: any) {
        cls[PROP_MODULE] = moduleName;
    }

    public static getClassModule(cls: any) {
        return cls[PROP_MODULE] || defaultModule;
    }

    public static attachImplClass(cls: any, implCls: any) {
        cls[PROP_IMPL_CLASS] = implCls;
    }

    public static attachModuleAndImplClass(cls: any, moduleName: any, implCls: any) {
        cls[PROP_MODULE] = moduleName;
        cls[PROP_IMPL_CLASS] = implCls;
    }

    public static getImplClass(cls: any) {
        return cls[PROP_IMPL_CLASS] || cls;
    }

    public static createFromModule(cls: any) {
        let implCls = this.getImplClass(cls) || cls;
        return new implCls();
    }
}
