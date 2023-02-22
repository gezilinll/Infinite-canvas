//@ts-ignore
import Module from "./wasm/InfiniteEngine";

export class WasmLoader {
    public static module: any = undefined;

    public static async init() {
        return new Promise(async (resolve, reject) => {
            const instance = await Module({
                locateFile: (path: string) => {
                    return path;
                },
            }).then((module: Module) => {
                return module;
            }).catch((err: any) => {
                console.error(err);
                return undefined;
            });

            if (instance) {
                WasmLoader.module = instance;
                // @ts-ignore
                window.mainModule = instance;
            }
            if (WasmLoader.module) {
                resolve(this.module);
            } else {
                reject("!!!Load Wasm Error!!!");
            }
        });
    }
}