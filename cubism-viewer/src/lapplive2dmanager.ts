import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { ACubismMotion } from '@framework/motion/acubismmotion';
import { CubismWebGLOffscreenManager } from '@framework/rendering/cubismoffscreenmanager';

import * as LAppDefine from './lappdefine';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';
import { parseViewerConfig } from './viewerbridge';

export class LAppLive2DManager {
  private releaseAllModel(): void {
    this._models.length = 0;
  }

  public setOffscreenSize(width: number, height: number): void {
    for (let i = 0; i < this._models.length; i++) {
      this._models[i]?.setRenderTargetSize(width, height);
    }
  }

  public onDrag(x: number, y: number): void {
    const model = this._models[0];
    if (model) {
      model.setDragging(x, y);
    }
  }

  public onTap(x: number, y: number): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`);
    }

    const model = this._models[0];
    if (!model) {
      return;
    }

    if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
      model.setRandomExpression();
      return;
    }

    if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
      model.startRandomMotion(
        LAppDefine.MotionGroupTapBody,
        LAppDefine.PriorityNormal,
        this.finishedMotion,
        this.beganMotion
      );
    }
  }

  public onUpdate(): void {
    const gl = this._subdelegate.getGl();
    CubismWebGLOffscreenManager.getInstance().beginFrameProcess(gl);

    const { width, height } = this._subdelegate.getCanvas();
    const projection = new CubismMatrix44();
    const model = this._models[0];

    if (!model) {
      return;
    }

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection);

    CubismWebGLOffscreenManager.getInstance().endFrameProcess(gl);
    CubismWebGLOffscreenManager.getInstance().releaseStaleRenderTextures(gl);
  }

  public nextScene(): void {
    this.changeScene();
  }

  private changeScene(): void {
    const config = parseViewerConfig();

    this.releaseAllModel();

    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(config.modelDir, config.modelJson);
    this._models.push(instance);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  public addModel(): void {
    this.changeScene();
  }

  public getModel(): LAppModel | null {
    return this._models[0] || null;
  }

  public constructor() {
    this._subdelegate = null;
    this._viewMatrix = new CubismMatrix44();
    this._models = new Array<LAppModel>();
  }

  public release(): void {}

  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    this.changeScene();
  }

  private _subdelegate: LAppSubdelegate;
  _viewMatrix: CubismMatrix44;
  _models: Array<LAppModel>;

  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Began:');
    console.log(self);
  };

  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished:');
    console.log(self);
  };
}
