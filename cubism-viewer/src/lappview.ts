import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';

import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { TouchManager } from './touchmanager';
import { LAppSubdelegate } from './lappsubdelegate';

export class LAppView {
  public constructor() {
    this._programId = null;
    this._touchManager = new TouchManager();
    this._deviceToScreen = new CubismMatrix44();
    this._viewMatrix = new CubismViewMatrix();
  }

  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    const { width, height } = subdelegate.getCanvas();

    const ratio = width / height;
    const left = -ratio;
    const right = ratio;
    const bottom = LAppDefine.ViewLogicalLeft;
    const top = LAppDefine.ViewLogicalRight;

    this._viewMatrix.setScreenRect(left, right, bottom, top);
    this._viewMatrix.scale(LAppDefine.ViewScale, LAppDefine.ViewScale);

    this._deviceToScreen.loadIdentity();
    if (width > height) {
      const screenW = Math.abs(right - left);
      this._deviceToScreen.scaleRelative(screenW / width, -screenW / width);
    } else {
      const screenH = Math.abs(top - bottom);
      this._deviceToScreen.scaleRelative(screenH / height, -screenH / height);
    }
    this._deviceToScreen.translateRelative(-width * 0.5, -height * 0.5);

    this._viewMatrix.setMaxScale(LAppDefine.ViewMaxScale);
    this._viewMatrix.setMinScale(LAppDefine.ViewMinScale);
    this._viewMatrix.setMaxScreenRect(
      LAppDefine.ViewLogicalMaxLeft,
      LAppDefine.ViewLogicalMaxRight,
      LAppDefine.ViewLogicalMaxBottom,
      LAppDefine.ViewLogicalMaxTop
    );
  }

  public release(): void {
    this._viewMatrix = null;
    this._touchManager = null;
    this._deviceToScreen = null;

    if (this._programId) {
      this._subdelegate.getGlManager().getGl().deleteProgram(this._programId);
      this._programId = null;
    }
  }

  public render(): void {
    this._subdelegate.getGlManager().getGl().useProgram(this._programId);
    this._subdelegate.getGlManager().getGl().flush();

    const live2dManager = this._subdelegate.getLive2DManager();
    if (live2dManager) {
      live2dManager.setViewMatrix(this._viewMatrix);
      live2dManager.onUpdate();
    }
  }

  public initializeSprite(): void {
    if (this._programId == null) {
      this._programId = this._subdelegate.createShader();
    }
  }

  public onTouchesBegan(pointX: number, pointY: number): void {
    this._touchManager.touchesBegan(
      pointX * window.devicePixelRatio,
      pointY * window.devicePixelRatio
    );
  }

  public onTouchesMoved(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;

    const live2dManager = this._subdelegate.getLive2DManager();
    const viewX = this.transformViewX(this._touchManager.getX());
    const viewY = this.transformViewY(this._touchManager.getY());

    this._touchManager.touchesMoved(posX, posY);
    live2dManager.onDrag(viewX, viewY);
  }

  public onTouchesEnded(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;
    const live2dManager = this._subdelegate.getLive2DManager();

    live2dManager.onDrag(0.0, 0.0);

    const x = this.transformViewX(posX);
    const y = this.transformViewY(posY);

    if (LAppDefine.DebugTouchLogEnable) {
      LAppPal.printMessage(`[APP]touchesEnded x: ${x} y: ${y}`);
    }

    live2dManager.onTap(x, y);
  }

  public transformViewX(deviceX: number): number {
    const screenX = this._deviceToScreen.transformX(deviceX);
    return this._viewMatrix.invertTransformX(screenX);
  }

  public transformViewY(deviceY: number): number {
    const screenY = this._deviceToScreen.transformY(deviceY);
    return this._viewMatrix.invertTransformY(screenY);
  }

  public transformScreenX(deviceX: number): number {
    return this._deviceToScreen.transformX(deviceX);
  }

  public transformScreenY(deviceY: number): number {
    return this._deviceToScreen.transformY(deviceY);
  }

  _touchManager: TouchManager;
  _deviceToScreen: CubismMatrix44;
  _viewMatrix: CubismViewMatrix;
  _programId: WebGLProgram;
  private _subdelegate: LAppSubdelegate;
}
