//basic
import { ISceneInfo, SceneUtil } from "./base/SceneUtils";
import { AudioMgr } from "./base/AudioMgr";
import { InputMgr } from "./base/InputMgr";
import { SafeJSON } from "./base/SafeJSON";
import { ResolutionAutoFit } from "./base/ResolutionAutoFit";
import { ModuleContext } from "./base/ModuleContext";
import { EventMgr } from "./base/EventMgr";

/*
//camera
import { FPSCamera } from "./camera/FPSCamera";
import { FollowCamera2D } from "./camera/FollowCamera2D";
import { FreeCamera } from "./camera/FreeCamera";
import { ThirdPersonCamera } from "./camera/ThirdPersonCamera";

//controller
import { CharacterMovement } from "./controller/CharacterMovement";
import { CharacterMovement2D } from "./controller/CharacterMovement2D";
import { EasyController, EasyControllerEvent } from "./controller/EasyController";
import { ThirdPersonCameraCtrl } from "./controller/ThirdPersonCameraCtrl";
import { UIJoystick } from "./controller/UIJoystick";
*/
//ui framework
import { UIAlert, Layout_UIAlert, UIAlertOptions } from "./ui_framework/alert/UIAlert";
import { Layout_UIWaiting } from "./ui_framework/waiting/Layout_UIWaiting";
import { UIWaiting } from "./ui_framework/waiting/UIWaiting";
import { UIController } from "./ui_framework/UIController";
import { UILayers, UILayerNames } from "./ui_framework/UILayers";
import { UIMgr } from "./ui_framework/UIMgr";
import { URLUtils } from "./base/URLUtils";
import { Utils } from "./base/Utils";
import { TweenUtils } from "./base/TweenUtils";
import ResMgr from "./base/ResMgr";
import { ELanguage, i18nMgr } from "./base/i18nMgr";
import Logger from "./base/Logger";
import { NetMgr } from "./network/NetMgr";
import { DefStringProtocol, INetworkTips, NetData } from "./network/NetInterface";
import { ECS } from "./ecs/ECS";
import { CCComp } from "./ecs/CCComp";
import LoopList, { ItemCell, ShowNode } from "./ui_framework/list/LoopList";
import RenderAlternative from "./ui_framework/list/RenderAlternative";
import { RenderReactiveHandler } from "./ui_framework/list/RenderReactiveHandler";
import { RedDotMgr } from "./redDot/RedDotMgr";
import { RedDotCalculateFunc, RedDotConfigTable } from "./redDot/RedDotStaticConfig";
import RedDotComponent from "./redDot/RedDotComponent";
import { HttpEvent, HttpMgr } from "./network/HttpMgr";
import { SimpleStateMachine, State, StateMachine } from "./fsm";
import { Layout_Toast } from "./ui_framework/tips/Layout_Toast";
import { UIToast } from "./ui_framework/tips/UIToast";

const __egf__ = {
    ISceneInfo,
    SceneUtil,
    AudioMgr,
    InputMgr,
    SafeJSON,
    ResolutionAutoFit,
    ModuleContext,
    EventMgr,
    ResMgr,
    i18nMgr,
    ELanguage,
    Logger,
    NetMgr,
    DefStringProtocol,
    /*
    FPSCamera,
    FollowCamera2D,
    FreeCamera,
    ThirdPersonCamera,
    CharacterMovement,
    CharacterMovement2D,
    EasyController,
    EasyControllerEvent,
    ThirdPersonCameraCtrl,
    UIJoystick,
    */
    Layout_UIAlert,
    UIAlert,
    UIAlertOptions,
    Layout_UIWaiting,
    UIWaiting,
    Layout_Toast,
    UIToast,
    UIController,
    UILayers,
    UILayerNames,
    UIMgr,
    URLUtils,
    Utils,
    TweenUtils,
    ECS,
    CCComp,
    LoopList,
    ShowNode,
    ItemCell,
    RenderAlternative,
    RenderReactiveHandler,
    RedDotMgr,
    RedDotComponent,
    HttpEvent,
    HttpMgr,
    SimpleStateMachine,
    StateMachine,
    State,
} as const;

(globalThis as any)["egf"] = __egf__;

declare global {
    namespace globalThis {
        namespace egf {
            export {
                ISceneInfo,
                SceneUtil,
                AudioMgr,
                InputMgr,
                SafeJSON,
                ResolutionAutoFit,
                ModuleContext,
                EventMgr,
                ResMgr,
                i18nMgr,
                ELanguage,
                Logger,
                NetMgr,
                DefStringProtocol,
                NetData,
                INetworkTips,
                /*
                FPSCamera,
                FollowCamera2D,
                FreeCamera,
                ThirdPersonCamera,

                CharacterMovement,
                CharacterMovement2D,
                EasyController,
                EasyControllerEvent,
                ThirdPersonCameraCtrl,
                UIJoystick,
                */
                Layout_UIAlert,
                UIAlert,
                UIAlertOptions,
                Layout_UIWaiting,
                UIWaiting,
                Layout_Toast,
                UIToast,
                UIController,
                UILayers,
                UILayerNames,
                UIMgr,
                URLUtils,
                Utils,
                TweenUtils,
                ECS,
                CCComp,
                LoopList,
                ShowNode,
                ItemCell,
                RenderAlternative,
                RenderReactiveHandler,
                RedDotMgr,
                RedDotCalculateFunc,
                RedDotConfigTable,
                RedDotComponent,
                HttpEvent,
                HttpMgr,
                SimpleStateMachine,
                StateMachine,
                State,
            };
        }
    }
    const egf_class: (module: string, superCls?: Function) => any;
}
