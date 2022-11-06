interface HTMLElement extends Record<string, any>{
    _vnode?: vnode | null
}

interface vnode {
    type: string,
    children?: any,
    // 使用Record限制对象的键名
    props?: Record<string, any>,
    // vnode对应的真实dom
    el?: HTMLElement,
    key: string
}

interface CreateRendererOptions {
    createElement(tag: string),
    setElementText(el: any, text: string),
    insert(el: any, parent: any, anchor: any = null),
    patchProps(el: any, key: any, prevValue: any, nextValue: any),
    unmount(vnode: vnode)
}