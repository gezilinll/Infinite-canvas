import { CanvasLoader } from "./CanvasLoader";
import { CanvasRenderingContext2D } from "./CanvasRenderingContext2D";
import { FontInfo } from "./FontInfo";

type WebGLContextHandle = number;

export class Canvas {
    private _userCanvas: HTMLCanvasElement | OffscreenCanvas | null = null;
    private _screenCanvas: HTMLCanvasElement | null = null;
    private _nativeCanvas: any = undefined;
    private _context2D: CanvasRenderingContext2D | null = null;
    private _glContextHandle: any = undefined;

    constructor(idOrElement: HTMLCanvasElement | OffscreenCanvas | string) {
        var isHTMLCanvas = typeof HTMLCanvasElement !== 'undefined' && idOrElement instanceof HTMLCanvasElement;
        var isOffscreenCanvas = typeof OffscreenCanvas !== 'undefined' && idOrElement instanceof OffscreenCanvas;
        if (!isHTMLCanvas && !isOffscreenCanvas) {
            if (!document.getElementById(idOrElement as string)) {
                throw 'Canvas with id ' + idOrElement + ' was not found';
            } else {
                this._userCanvas = document.getElementById(idOrElement as string) as HTMLCanvasElement;
                isHTMLCanvas = true;
            }
        } else {
            this._userCanvas = isHTMLCanvas ? idOrElement as HTMLCanvasElement : idOrElement as OffscreenCanvas;
        }

        this._nativeCanvas = CanvasLoader.module.makeCanvas(this._userCanvas!.width, this._userCanvas!.height);
        if (isHTMLCanvas) {
            this._screenCanvas = document.createElement('canvas');
            this._screenCanvas.width = this._userCanvas.width;
            this._screenCanvas.height = this._userCanvas.height;
            (this._userCanvas as HTMLCanvasElement).parentNode!.replaceChild(this._screenCanvas, this._userCanvas as HTMLCanvasElement);
        }
    }

    delete() {
        this._context2D?.delete();
        this._nativeCanvas?.delete();
    }

    getContext(contextId: "2d", options?: CanvasRenderingContext2DSettings): CanvasRenderingContext2D | null {
        if (!this._context2D) {
            var ctx = this._getWebGLContext(this._userCanvas!);
            if (!ctx || ctx < 0) {
                throw 'failed to create webgl context: err ' + ctx;
            }
            this._glContextHandle = ctx;
            this._context2D = new CanvasRenderingContext2D(this._nativeCanvas.get2DContext(), this._userCanvas!.width, this._userCanvas!.height);
        }
        return this._context2D;
    }

    loadFont(fontBuffer: ArrayBuffer, descriptor: FontInfo) {
        var data = new Uint8Array(fontBuffer);
        var ptr = CanvasLoader.module._malloc(data.byteLength);
        CanvasLoader.module.HEAPU8.set(data, ptr);
        this._nativeCanvas?.loadFont(ptr, data.byteLength, descriptor.family, descriptor.style, descriptor.weight);
        // We do not need to free the data since the C++ will do that for us
        // when the font is deleted (or fails to decode);
    }

    flush() {
        CanvasLoader.module.GL.makeContextCurrent(this._glContextHandle);
        this._nativeCanvas?.flush();
        if (this._context2D && this._screenCanvas) {
            let imageData = this._context2D.readPixels();
            if (imageData) {
                this._screenCanvas.getContext('2d')?.putImageData(imageData, 0, 0);
            }
        }
    }

    private _getWebGLContext(canvas: HTMLCanvasElement | OffscreenCanvas): WebGLContextHandle {
        var contextAttributes = {
            'alpha': 1,
            'depth': 1,
            'stencil': 8,
            'antialias': 0,
            'premultipliedAlpha': 1,
            'preserveDrawingBuffer': 0,
            'preferLowPowerToHighPerformance': 0,
            'failIfMajorPerformanceCaveat': 0,
            'enableExtensionsByDefault': 1,
            'explicitSwapControl': 0,
            'renderViaOffscreenBackBuffer': 0,
            'majorVersion': (typeof WebGL2RenderingContext !== 'undefined') ? 2 : 1,
        };
        var handle = CanvasLoader.module.GL.createContext(canvas, contextAttributes);
        if (!handle) {
            throw 'GL.createContext failed';
        }
        CanvasLoader.module.GL.makeContextCurrent(handle);
        // Emscripten does not enable this by default and Skia needs this to handle certain GPU corner cases.
        CanvasLoader.module.GL.currentContext.GLctx.getExtension('WEBGL_debug_renderer_info');
        return handle;
    }
}