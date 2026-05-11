import { LogLevel } from '@framework/live2dcubismframework';

export const CanvasSize: { width: number; height: number } | 'auto' = 'auto';
export const CanvasNum = 1;

export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -2.0;
export const ViewLogicalMaxRight = 2.0;
export const ViewLogicalMaxBottom = -2.0;
export const ViewLogicalMaxTop = 2.0;

export const ResourcesPath = '/';
export const ShaderPath = '/cubism-sdk/Shaders/WebGL/';

export const BackImageName = '';
export const GearImageName = '';
export const PowerImageName = '';

export const ModelDir: string[] = [];
export const ModelDirSize = 0;

export const MotionGroupIdle = 'Idle';
export const MotionGroupTapBody = 'TapBody';

export const HitAreaNameHead = 'Head';
export const HitAreaNameBody = 'Body';

export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

export const MOCConsistencyValidationEnable = true;
export const MotionConsistencyValidationEnable = true;

export const DebugLogEnable = false;
export const DebugTouchLogEnable = false;

export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Warning;

export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;
