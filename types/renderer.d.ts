interface HTMLElement extends Record<string, any>{
    _vnode?: vnode | null
}

interface Component {
    name: string,
    render: () => vnode,
    data(),
    beforeCreate?: Fn,
    created?: Fn,
    beforeMount?: Fn,
    mounted?: Fn,
    beforeUpdate?: Fn,
    updated?: Fn,
}

interface ComponentInstance {
    state: any,
    isMounted: boolean,
    subTree: vnode | null
}

interface vnode {
    type: string | Component,
    children?: any,
    // 使用Record限制对象的键名
    props?: Record<string, any>,
    // vnode对应的真实dom
    el?: HTMLElement,
    key?: string,
    component?: ComponentInstance
}

interface CreateRendererOptions {
    createElement(tag: string),
    setElementText(el: any, text: string),
    insert(el: any, parent: any, anchor: any = null),
    patchProps(el: any, key: any, prevValue: any, nextValue: any),
    unmount(vnode: vnode)
}