export class Element {
    private _id: number;
    protected _nativeElement: any = undefined;

    constructor(id: number) {
        this._id = id;
    }

    get ID() {
        return this._id;
    }

    protected setNativeElement(element: any) {
        this._nativeElement = element;
    }

    getNativeElement() {
        return this._nativeElement;
    }
}