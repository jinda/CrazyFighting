//AudioMgr.ts
import { Node, AudioSource, AudioClip, director, assetManager } from "cc";
import { EDITOR_NOT_IN_PREVIEW } from "cc/env";
/**
 * @en
 * this is a sington class for audio play, can be easily called from anywhere in you project.
 * @zh
 * 这是一个用于播放音频的单件类，可以很方便地在项目的任何地方调用。
 */

const EFFECT_NUM = 8;
class AudioManager {
    private static _inst: AudioManager | null = null;
    public static get inst(): AudioManager {
        if (this._inst == null) {
            this._inst = new AudioManager();
        }
        return this._inst;
    }

    private _musicSource: AudioSource = null!;
    private _effectSources: Array<AudioSource> = [];
    private _musicVolume = 1.0;
    private _musicVolumeScale = 1.0;
    private _soundVolume = 1.0;
    private _bundleName = "resources";
    private _currentEffect = 0;
    constructor() {
        if (EDITOR_NOT_IN_PREVIEW) {
            return;
        }
        //@en create a node as audioMgr
        //@zh 创建一个节点作为 audioMgr
        let audioMgr = director.getScene()?.getChildByName("__audioMgr__");
        if (!audioMgr) {
            audioMgr = new Node();
            audioMgr.name = "__audioMgr__";

            //@en add to the scene.
            //@zh 添加节点到场景
            director.getScene()?.addChild(audioMgr);

            //@en make it as a persistent node, so it won't be destroied when scene change.
            //@zh 标记为常驻节点，这样场景切换的时候就不会被销毁了
            director.addPersistRootNode(audioMgr);
        }

        //@en add AudioSource componrnt to play audios.
        //@zh 添加 AudioSource 组件，用于播放音频。
        const audioSources = audioMgr.getComponents(AudioSource);
        console.log("AudioMgr audioSources:", audioSources.length);
        if (audioSources.length > 0) {
            this._musicSource = audioSources[0];
        } else {
            this._musicSource = audioMgr.addComponent(AudioSource);
        }

        for (var i = 0; i < EFFECT_NUM; i++) {
            if (audioSources.length > i + 1) {
                this._effectSources.push(audioSources[i + 1]);
            } else {
                var as = audioMgr.addComponent(AudioSource);
                this._effectSources.push(as);
            }
            this._effectSources[i].volume = this._soundVolume;
        }
    }

    public get audioSource() {
        return this._musicSource;
    }

    public set musicVolume(v: number) {
        this._musicVolume = v;
        this._musicSource.volume = this._musicVolume * this._musicVolumeScale;
    }

    public set soundVolume(v: number) {
        this._soundVolume = v;
        // Update all effect source volumes immediately
        for (const source of this._effectSources) {
            source.volume = this._soundVolume;
        }
    }

    public set bgmType(_t: number) {
        //保留 API：当前版本未使用背景音乐类型区分，参数仅占位
    }

    public set bundleName(name: string) {
        this._bundleName = name;
    }

    /**
     * @en
     * play short audio, such as strikes,explosions
     * @zh
     * 播放短音频,比如 打击音效，爆炸音效等
     * @param sound clip or url for the audio
     * @param volume
     */
    playOneShot(sound: AudioClip | string, volume: number = 1.0, bundleName?: string) {
        if (volume * this._soundVolume <= 0) {
            return;
        }
        bundleName = bundleName || this._bundleName;

        var sources = this._effectSources[this._currentEffect];
        this._currentEffect++;
        if (this._currentEffect >= EFFECT_NUM) {
            this._currentEffect = 0;
        }
        if (sound instanceof AudioClip) {
            sources.clip = sound;
            sources.volume = this._soundVolume;
            sources.playOneShot(sound, volume * this._soundVolume);
        } else {
            let bundle = assetManager.getBundle(bundleName);
            bundle?.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    egf.Logger.error("playOneShot error:", err);
                } else {
                    sources.clip = clip;
                    sources.volume = this._soundVolume;
                    sources.playOneShot(clip, volume * this._soundVolume);
                }
            });
        }
    }

    /**
     * @en
     * play long audio, such as the bg music
     * @zh
     * 播放长音频，比如 背景音乐
     * @param sound clip or url for the sound
     * @param volume
     */
    play(sound: AudioClip | string, volume: number = 1.0, bundleName?: string) {
        this._musicVolumeScale = volume;
        if (this._musicVolume * this._musicVolumeScale <= 0) {
            return;
        }
        bundleName = bundleName || this._bundleName;
        if (sound instanceof AudioClip) {
            this._musicSource.stop();
            this._musicSource.clip = null;
            this._musicSource.clip = sound;
            this._musicSource.play();
            this._musicSource.loop = true;
            this.audioSource.volume = this._musicVolume * this._musicVolumeScale;
        } else {
            let bundle = assetManager.getBundle(bundleName);
            bundle?.load(sound, (err, clip: AudioClip) => {
                if (err) {
                    egf.Logger.log("AudioMgr play error", err);
                } else {
                    egf.Logger.log("AudioMgr play clip:", clip.name);
                    this._musicSource.stop();
                    this._musicSource.clip = null;
                    this._musicSource.clip = clip;
                    this._musicSource.play();
                    this._musicSource.loop = true;
                    this.audioSource.volume = this._musicVolume * this._musicVolumeScale;
                }
            });
        }
    }

    /**
     * stop the audio play
     */
    stop() {
        egf.Logger.log("AudioMgr stop");
        this._musicSource.stop();
        this._musicSource.clip = null;
    }

    /**
     * stop the effect audio play
     */
    stopShot(sound: AudioClip | string) {
        this._effectSources.forEach((as) => {
            if (as.clip === sound) {
                as.stop();
                as.clip = null;
            } else if (as?.clip?.name === sound) {
                as.stop();
                as.clip = null;
            }
        });
    }

    /**
     * pause the audio play
     */
    pause() {
        this._musicSource.pause();
    }

    /**
     * resume the audio play
     */
    resume() {
        this._musicSource.play();
    }
}

export const AudioMgr = AudioManager.inst;
