interface HTMLElement extends Record<string, any>{
    _vnode?: vnode | null
}

type LifeCycleFn = (context?: any) => any
type RenderFn = () => vnode

interface Component {
    name: string,
    props?: Record<string, any>,
    methods?: Recode<string, Fn>,
    render?: RenderFn,
    data?: () => any,
    setup?: (props?: Record<string, any>, setupContext?: any) => object | RenderFn,
    beforeCreate?: LifeCycleFn,
    created?: LifeCycleFn,
    beforeMount?: LifeCycleFn,
    mounted?: LifeCycleFn,
    beforeUpdate?: LifeCycleFn,
    updated?: LifeCycleFn,
}

interface ComponentInstance {
    state: any,
    isMounted: boolean,
    subTree: vnode | null,
    props: any,
    methods: Record<string, Fn>
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