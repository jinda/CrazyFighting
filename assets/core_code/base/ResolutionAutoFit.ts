import { _decorator, Component, view, screen, Size, size, ResolutionPolicy, Node, v3, isValid, sys } from "cc";
const { ccclass } = _decorator;

const CHECK_INTERVAL = 0.1;

@ccclass("ResolutionAutoFit")
export class ResolutionAutoFit extends Component {
    private _oldSize: Size = size();
    onLoad() {
        this.adjustResolutionPolicy();
    }

    private _lastCheckTime = 0;
    update(deltaTime: number) {
        this._lastCheckTime += deltaTime;
        if (this._lastCheckTime < CHECK_INTERVAL) {
            return;
        }
        this._lastCheckTime = 0;

        this.adjustResolutionPolicy();
    }

    adjustResolutionPolicy() {
        let winSize = screen.windowSize;
        if (!this._oldSize.equals(winSize)) {
            this.setWindowResize(winSize.width, winSize.height);
            winSize = screen.windowSize;
            const ratio = winSize.width / winSize.height;
            const drs = view.getDesignResolutionSize();
            const drsRatio = drs.width / drs.height;
            egf.Logger.log("adjustResolutionPolicy ratio:", ratio, "drsRatio:", drsRatio);

            if (ratio > drsRatio) {
                //wider than desgin. fixed height
                view.setResolutionPolicy(ResolutionPolicy.FIXED_HEIGHT);
            } else {
                //
                view.setResolutionPolicy(ResolutionPolicy.FIXED_WIDTH);
            }
            this._oldSize.set(winSize);
        }
    }
    setWindowResize(width: number, height: number) {
        console.log("setWindowResize origin:", width, height);
        const bHorizontal = width > height;
        if (bHorizontal && !sys.isMobile && sys.isBrowser) {
            const height = window.innerHeight;
            const uiDesignSize = view.getDesignResolutionSize();
            var designRatio = uiDesignSize.width / uiDesignSize.height; // 假设设计分辨率为 9:16
            const width = height * designRatio;
            window.innerWidth = width;

            let gameDiv = document.getElementById("GameDiv");
            let gameCanvas = document.getElementById("GameCanvas");
            if (gameDiv && gameCanvas) {
                gameDiv.style.height = `${height}px`;
                gameDiv.style.width = `${width}px`;
                // @ts-ignore
                gameCanvas["width"] = width;
                // @ts-ignore
                gameCanvas["height"] = height;
            }
            console.log("windown resize:", width, height);
            screen.windowSize = new Size(width, height);
            window.dispatchEvent(new Event("resize"));
        }
    }

    static adjustBg(nodeBg: Node) {
        if (isValid(nodeBg)) {
            const viewSize = view.getVisibleSize();
            const uiDesignSize = view.getDesignResolutionSize();
            const widthRatio = viewSize.width / uiDesignSize.width;
            const heightRatio = viewSize.height / uiDesignSize.height;
            let factorScale = 1;
            if (widthRatio > heightRatio) {
                factorScale = widthRatio;
            } else {
                factorScale = heightRatio;
            }
            // const scale = viewSize.height / (uiDesignSize.height * factorScale);
            egf.Logger.log("adjustBg:", viewSize, uiDesignSize, widthRatio, heightRatio, factorScale);

            nodeBg.setScale(v3(factorScale, factorScale, 1));
        }
    }

    static getAdaptX(): number {
        const t = view.getDesignResolutionSize();
        const winSize = view.getVisibleSize();
        return (winSize.width - t.width) / 2;
    }

    static getAdaptY(): number {
        const t = view.getDesignResolutionSize();
        const winSize = view.getVisibleSize();

        return (winSize.height - t.height) / 2;
    }
}
