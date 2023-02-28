import { InfiniteLoader } from "../src/InfiniteLoader";
import { InfiniteEngine } from "../src/InfiniteEngine";
import { ImageElement } from "../src/element/ImageElement";

const { default: wasmURL } = await import('./InfiniteEngine.wasm?url');
InfiniteLoader.wasmPath = wasmURL;

InfiniteLoader.init().then(async () => {
    let engine = new InfiniteEngine("canvas");

    const response = await fetch("http://rqm1nmwwk.hn-bkt.clouddn.com/logo.jpg");
    const arrayBuffer = await response.arrayBuffer();
    // response.blob() is preferable when you don't need both a Blob *and* an ArrayBuffer.
    const blob = new Blob([arrayBuffer]);
    const imageBitmap = await createImageBitmap(blob);
    const canvasBitmapElement = document.createElement('canvas');
    canvasBitmapElement.width = imageBitmap.width;
    canvasBitmapElement.height = imageBitmap.height;
    const ctxBitmap = canvasBitmapElement.getContext('bitmaprenderer');
    ctxBitmap.transferFromImageBitmap(imageBitmap);

    function addRandomElement() {
        let sx = Math.random() * 100;
        let sy = Math.random() * 50;
        let sw = Math.random() * 100;
        let sh = Math.random() * 100;
        let dx = Math.random() * 500;
        let dy = Math.random() * 500;
        let dw = Math.random() * 200;
        let dh = Math.random() * 200;
        let imageElement = new ImageElement(0);
        imageElement.setSource(canvasBitmapElement);
        imageElement.setSrcRect(sx, sy, sw, sh);
        imageElement.setDstRect(dx, dy, dw, dh);
        engine.addElement(imageElement);
        requestAnimationFrame(addRandomElement);
    }
    requestAnimationFrame(addRandomElement);
});