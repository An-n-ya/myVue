import {ref, effect, reactive, shallowReactive, shallowReadonly} from "./reactivity.js"


function shouldSetAsProps(el: HTMLElement, key: string, value: any) {
    // 对一些属性做特殊处理

    // input 的 form 属性是只读的
    if (key === "form" && el.tagName === "INPUT") return false

    return key in el
}

function normalizeClass(input: any) {
    let ret = []
    if (Array.isArray(input)) {
        for (const ele of input) {
            if (typeof ele === 'string') {
                ret.push(ele)
            } else if (typeof ele === 'object') {
                for (const key in ele) {
                    if (ele[key]) {
                        ret.push(key)
                    }
                }
            }
        }
    } else if (typeof input === 'object') {
        for (const key in input) {
            if (input[key]) {
                ret.push(key)
            }
        }
    }
    return ret.join(" ")
}

function createRenderer(options: CreateRendererOptions) {
    // 通过options得到控制 node 的操作
    // 用以跨平台
    const {
        createElement,
        insert,
        setElementText,
        patchProps,
        unmount
    } = options

    // 任务缓存队列
    const queue = new Set<Fn>()
    let isFlushing = false
    const p = Promise.resolve()

    function queueJob(job: Fn) {
        queue.add(job)
        if (!isFlushing) {
            isFlushing = true
            // 在微任务中刷新缓冲队列
            p.then(() => {
                try {
                    // 执行任务队列中的任务
                    queue.forEach(job => job())
                } finally {
                    // 重置状态
                    isFlushing = false
                    queue.clear()
                }
            })
        }
    }

    function patch(n1: vnode | undefined | null, n2: vnode, container: HTMLElement, anchor: Node | null = null) {
        if (!n1) {
            if (typeof n2.type === 'string') {
                // 如果n1 不存在，意味着挂载
                mountElement(n2, container, anchor)
            } else if (typeof n2.type === 'object') {
                mountComponent(n2, container, anchor)
            }
        } else if (n1 && n1.type !== n2.type) {
            // 如果n1存在， 并且n1的类型和n2的类型不一致，则直接卸载n1
            unmount(n1)
            n1 = null
        } else if (n1 && n1.type === n2.type) {
            // 如果n1存在， 并且n1的类型和n2的类型一致，则需要根据n2的type打补丁
            const {type} = n2
            if (typeof type === "string") {
                // DONE: patchElement(n1, n2)
                patchElement(n1, n2)
            } else if (typeof type === 'object') {
                // 如果n1存在，意味着打补丁，这时候是对组件打补丁
                patchComponent(n1, n2, anchor)
            }

        }
    }

    function resolveProps(options: Record<string, any> | undefined, propsData: Record<string, any> | undefined) {
        const props: Record<string, any> = {}
        const attrs: Record<string, any> = {}
        for (const key in propsData) {
            if (options && key in options) {
                // 组件的props里的属性(即用：修饰过的props)作为props
                props[key] = propsData[key]
            } else {
                // 组件props以外的属性，作为attrs
                attrs[key] = propsData[key]
            }
        }

        return [props, attrs]
    }

    // 挂载组件
    function mountComponent(vnode: vnode, container: HTMLElement, anchor: Node | null) {
        if (typeof vnode.type === 'string') {
            // 只处理组件
            return
        }
        // 获取组件对象
        const componentOptions = vnode.type
        // 获取组件的render函数和data函数
        let {
            render,
            data,
            setup,
            methods,
            props: propsOption,
            beforeCreate,
            created,
            beforeMount,
            mounted,
            beforeUpdate,
            updated
        } = componentOptions

        // 创建之前
        beforeCreate && beforeCreate()

        // 响应化data
        const state =  data ? reactive(data()) : null

        const [props, attrs] = resolveProps(propsOption, vnode.props)
        // 创建一个组件实例，作为组件状态的一个集合，用于统一管理
        const instance: ComponentInstance = {
            state,              // 组件自身状态
            isMounted: false,   // 表示组件是否已经被挂载
            subTree: null,       // 组件所渲染的vnode
            props: shallowReactive(props),   // 将props包装为shallowReactive定义到组件实例上
            methods
        }

        function emit(event: string, ...payload: any) {
            // 根据约定对事件名进行处理 比如 chang --> onChange
            const eventName = `on${event[0].toUpperCase() + event.slice(1)}`
            // 在props寻找事件处理函数
            const handler = instance.props[eventName]
            if (handler) {
                handler(...payload)
            } else {
                console.log('事件处理函数不存在')
            }
        }

        const setupContext = {attrs, emit}

        // 调用setup函数
        const setupResult = setup ? setup(shallowReadonly(instance.props), setupContext) : {}
        let setupState: any = null
        if (typeof setupResult === 'function') {
            if (render) console.error('setup函数返回渲染函数，render将被忽略')
            render = setupResult as RenderFn
        } else {
            setupState = setupResult
        }

        // 将instance设置到vnode上，用于后续更新
        vnode.component = instance

        const renderContext = new Proxy(instance, {
            get(t, k, r) {
                const {state, props} = t
                if (state && k in state) {
                    // 现在state里找
                    return state[k]
                } else if (props && k in props) {
                    // 再在props里找
                    return props[k]
                } else if (methods && k in methods) {
                    return methods[k]
                } else if (setupState && k in setupState) {
                    return setupState[k]
                } else {
                    console.error("属性不在组件实例中")
                }
            },
            set(t, k, v, r) {
                const {state, props} = t
                if (state && k in state) {
                    state[k] = v
                } else if (props && k in props) {
                    props[k] = v
                } else if (methods && k in methods) {
                    methods[k] = v
                } else if (setupState && k in setupState) {
                    setupState[k] = v
                } else {
                    console.error("属性不在组件实例中")
                    return false
                }
                return true
            }
        })

        // 实例创建完毕，调用created
        created && created(renderContext)

        effect(() => {
            // 执行渲染函数
            const subTree = (render as RenderFn).call(renderContext)
            if (!instance.isMounted) {
                // 挂载前调用beforeMount
                beforeMount && beforeMount(renderContext)
                // 初次加载，patch的第一个参数是null
                patch(null, subTree, container, anchor)
                // 设置isMounted
                instance.isMounted = true

                // 挂载完后调用mounted
                mounted && mounted(renderContext)
            } else {
                // 更新前调用beforeUpdate
                beforeUpdate && beforeUpdate(renderContext)
                // 若组件之前已经加载
                patch(instance.subTree, subTree, container, anchor)

                // 更新完后调用updated
                updated && updated(renderContext)
            }
            // 更新 subTree
            instance.subTree = subTree
            // patch函数打补丁
        }, {
            scheduler: queueJob
        })

    }

    // 对组件打补丁
    function patchComponent(n1: vnode, n2: vnode, anchor: Node | null) {
        // 复用component，让新vnode n2的component指向n1的
        const instance = (n2.component = n1.component)
        if (!instance || typeof n2.type === 'string' || typeof n1.type === 'string') {
            // 如果类型不对，直接返回
            return
        }
        const {props} = instance
        if (hasProsChanged(n1.props, n2.props)) {
            // 从新的vnode中找出props
            const [nextProps] = resolveProps(n2.type.props, n2.props)

            // 更新props
            for (const k in nextProps) {
                // 这里的props是代理对象，在代理函数中进行了响应式操作
                props[k] = nextProps[k]
            }

            // 删除不存在的props
            for (const k in props) {
                if (!(k in nextProps)) delete props[k]
            }
        }
    }

    function hasProsChanged(prevProps: object | undefined, nextProps: object | undefined) {
        if (!prevProps && !nextProps) {
            return false
        } else if (!prevProps || !nextProps) {
            return true
        }
        const nextKeys = Object.keys(nextProps)
        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true
        }

        for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i]
            // 有不相等的props，这说明有变化
            // @ts-ignore
            if (nextProps[key] !== prevProps[key]) {
                return true
            }

        }
        return false
    }

    function patchElement(n1: vnode, n2: vnode) {
        // n1的el赋值给n2 (这个赋值操作，就是所谓的复用DOM了)
        const el = n2.el = n1.el
        const oldProps = n1.props || {}
        const newProps = n2.props || {}

        // 先更新 props
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key])
            }
        }
        for (const key in oldProps) {
            if (!(key in newProps)) {
                patchProps(el, key, oldProps[key], null)
            }
        }
        if (el) {
            // 再更新 children
            patchChildren(n1, n2, el)
        }
    }

    // 暴力diff算法，先卸载全部旧节点，再挂载新节点 (不能复用DOM节点，需要反复卸载与挂载)
    function bruteDiff(oldChildren: vnode[], newChildren: vnode[], container: HTMLElement) {
        oldChildren.forEach(c => unmount(c))
        newChildren.forEach(c => patch(null, c, container))
    }

    // 最简单的diff算法 复杂度为O(n2)
    function simpleDiff(oldChildren: vnode[], newChildren: vnode[], container: HTMLElement) {
        // 维护寻找过程中最大的索引
        // 如果当前索引小于lastIndex，就说明需要调换位置
        let lastIndex = 0
        for (let i = 0; i < newChildren.length; i++) {
            const newVnode = newChildren[i]
            // 如果在oldChildren找到了newVnode的key，说明可以复用，find为true，否则为false
            let find = false
            for (let j = 0; j < oldChildren.length; j++) {
                const oldVnode = oldChildren[j]
                if (newVnode.key === oldVnode.key) {
                    // 将find值true
                    find = true
                    // 如果key相同，即可以复用
                    patch(oldVnode, newVnode, container)
                    if (j < lastIndex) {
                        // 这里进行移动操作
                        // 先获取前一个vnode
                        const prevNode = newChildren[i-1]
                        // 如果prevNode不存在，说明是第一个节点，不需要移动
                        if (prevNode) {
                            // 将当前节点移动到上一个节点的后面
                            const anchor = prevNode.el?.nextSibling
                            insert(newVnode.el, container, anchor)
                        }
                    } else {
                        // 如果j比较大, 则更新lastIndex
                        lastIndex = j
                    }
                    break
                }
            }
            if (!find) {
                // 如果在oldChildren中没有找到，说明当前newVnode是新增的节点
                const prevVNode = newChildren[i - 1]
                let anchor = null
                if (prevVNode) {
                    // 如果有prevVnode，就用nextSibling作为锚点
                    anchor = prevVNode.el?.nextSibling == undefined ? null : prevVNode.el?.nextSibling
                } else {
                    // 如果没有prevVnode，说明是第一个节点，则使用容器的第一个元素作为锚点
                    anchor = container.firstChild
                }
                patch(null, newVnode, container, anchor)
            }

        }

        // 进行卸载操作
        for (let i = 0; i < oldChildren.length; i++) {
            const oldVnode = oldChildren[i]
            const has = newChildren.find(
                vnode => vnode.key === oldVnode.key
            )
            if (!has) {
                // 如果没有找到，就需要删除
                unmount(oldVnode)
            }
        }
    }

    function dualEndDiff(oldChildren: vnode[] | undefined[], newChildren: vnode[], container: HTMLElement) {
        // 四个索引值
        let oldStartIdx = 0
        let oldEndIdx = oldChildren.length - 1
        let newStartIdx = 0
        let newEndIdx = newChildren.length - 1

        // 四个索引指向的 vnode 节点
        let oldStartVNode = oldChildren[oldStartIdx]
        let oldEndVNode = oldChildren[oldEndIdx]
        let newStartVNode = newChildren[newStartIdx]
        let newEndVNode = newChildren[newEndIdx]

        // 进入循环
        while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
            if (!oldStartVNode) {
                oldStartVNode = oldChildren[++oldStartIdx]
            } else if (!oldEndVNode) {
                oldEndVNode = oldChildren[--oldEndIdx]
            } else if (oldStartVNode.key === newStartVNode.key) {
                patch(oldStartVNode, newStartVNode, container)
                oldStartVNode = oldChildren[++oldStartIdx]
                newStartVNode = newChildren[++newStartIdx]

            } else if (oldEndVNode.key === newEndVNode.key) {
                // 新节点仍然处在末尾位置，不需要移动
                // 只需要打补丁
                patch(oldEndVNode, newEndVNode, container)
                // 更新指针
                oldEndVNode = oldChildren[--oldEndIdx]
                newEndVNode = newChildren[--newEndIdx]

            } else if (oldStartVNode.key === newEndVNode.key) {
                // 先打补丁🍮
                patch(oldStartVNode, newEndVNode, container)
                // 此时头节点需要移动到末尾
                insert(oldStartVNode.el, container, oldEndVNode.el?.nextSibling)

                oldStartVNode = oldChildren[++oldStartIdx]
                newEndVNode = newChildren[--newEndIdx]

            } else if (oldEndVNode.key === newStartVNode.key) {
                // 先打补丁🍮
                patch(oldEndVNode, newStartVNode, container)
                // 移动DOM
                insert(oldEndVNode.el, container, oldStartVNode.el)

                // 更新指针
                oldEndVNode = oldChildren[--oldEndIdx]
                newStartVNode = newChildren[++newStartIdx]
            } else {
                // 四种情况都没有命中 (这一步的复杂度最高，因为需要遍历查找）
                // 在最坏情况下，如果每次都进入这一步，该方法就会退化成简单diff(可以用哈希表简化)
                // 从oldChildren中遍历寻找和newStartVNode
                const idxInOld = oldChildren.findIndex(
                    node => node && node.key === newStartVNode.key
                )

                if (idxInOld > 0) {
                    // 说明新节点是可复用的节点，移动到头部即可
                    const vnodeToMove = oldChildren[idxInOld]
                    if (!vnodeToMove) {
                        /// 既然idxInOld大于零，应该不可能进入到这里
                        continue
                    }
                    // 打补丁
                    patch(vnodeToMove, newStartVNode, container)
                    // 移动到头部
                    insert(vnodeToMove.el, container, oldStartVNode.el)
                    // idxIndOld处的节点已经移动，因此置undefined
                    oldChildren[idxInOld] = undefined
                } else {
                    // 如果没有找到，说明是新节点
                    patch(null, newStartVNode, container, oldStartVNode.el)
                }
                newStartVNode = newChildren[++newStartIdx]
            }
        }
        if (oldEndIdx < oldStartIdx && newStartIdx <= newEndIdx) {
            // 循环结束后，判断是否还有遗留的新节点
            if (oldStartVNode) {
                for (let i = newStartIdx; i <= newEndIdx; i++) {
                    // 把剩下的节点都加入到头部
                    patch(null, newChildren[i], container, oldStartVNode.el)
                }
            }
        } else if (newEndIdx < newStartIdx && oldStartIdx <= oldEndIdx) {
            // 判断是否还有剩余的旧节点，这些节点需要卸载
            for (let i = oldStartIdx; i <= oldEndIdx; i++) {
                if (oldChildren[i]) {
                    // @ts-ignore
                    unmount(oldChildren[i])
                }
            }
        }

    }


    function patchChildren(n1: vnode, n2: vnode, container: HTMLElement) {
        // 先判断新节点是字符串的情况
        if (typeof n2.children === "string") {
            // 旧节点有三种可能: null 文本子节点 组子节点
            // 只有在旧节点是一组子节点的时候，需要逐个卸载，其他情况什么都不用做
            if (Array.isArray(n1.children)) {
                n1.children.forEach((c) => unmount(c))
            }
            // 最后将新节点(string)设置给容器
            setElementText(container, n2.children)
        } else if (Array.isArray(n2.children)) {
            // 如果新节点是一组节点
            if (Array.isArray(n1.children)) {
                // 如果旧节点也是一组节点，需要用到diff算法
                // Done: diff算法
                // dualEndDiff(n1.children, n2.children, container)
                simpleDiff(n1.children, n2.children, container)
                // bruteDiff(n1.children, n2.children, container)
            } else {
                // 旧子节点要么是string要么为空
                // 无论那种情况只需要清空容器，再逐个挂载即可
                setElementText(container, "")
                n2.children.forEach(c => patch(null, c, container, null))
            }
        } else {
            // 运行到这里，说明新节点不存在
            if (Array.isArray(n1.children)) {
                // 逐个卸载旧子节点
                n1.children.forEach((c) => unmount(c))
            } else if (typeof n1.children === "string") {
                // 旧节点为字符，清空字符即可
                setElementText(container, "")
            }
            // 旧节点也没有子节点，啥都不做
        }
    }

    function mountElement(vnode: vnode, container: HTMLElement, anchor: Node | null) {
        // 创建 DOM 元素
        // 把真实 dom 元素和 vnode 关联起来
        if (typeof vnode.type !== 'string') {
            return;
        }
        const el = vnode.el = createElement(vnode.type)
        if (typeof vnode.children === "string") {
            // 如果 vnode 的子节点是字符串，代表元素只有文本节点
            // 直接设置textContent就好
            // el.textContent = vnode.children
            setElementText(el, vnode.children)
        } else if (Array.isArray(vnode.children)) {
            // 递归处理每个子元素
            vnode.children.forEach(child => {
                patch(null, child, el, anchor)
            })
        }
        // 处理props
        if (vnode.props) {
            for(const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key])
            }
        }
        // 在容器中添加元素
        insert(el, container, anchor)
    }

    function render(vnode: vnode | null | undefined, container: HTMLElement | null) {
        if(!container) {
            // 如果container不存在，直接返回
            return
        }
        // 如果vnode存在
        if (vnode) {
            // 对新老vnode做patch
            patch(container._vnode, vnode, container, null)
        } else {
            // 如果vnode不存在，说明是卸载操作
            // 如果老vnode存在，就让内部html清空
            if (container._vnode) {
                unmount(container._vnode)
            }
        }
        // 把当前vnode赋值给_vnode, 作为老vnode
        container._vnode = vnode
    }

    return render
}

let createCnt = 0 // 记录使用了多少次创建节点的dom操作
let removeCnt = 0 // 记录使用了多少次删除节点的dom操作
let moveCnt = 0

const renderer = createRenderer({
    createElement(tag: string) {
        createCnt += 1
        return document.createElement(tag)
    },
    setElementText(el: HTMLElement, text: string) {
        el.textContent = text
    },
    insert(el: HTMLElement, parent: HTMLElement, anchor: Node | null = null) {
        moveCnt += 1
        parent.insertBefore(el, anchor)
    },
    patchProps(el: HTMLElement, key: string, prevValue: any, nextValue: any) {
        if (/^on/.test(key)) {
            // 如果是以on开头的，就说明是事件绑定
            const name = key.slice(2).toLowerCase()
            // 获取之前的事件处理函数集合
            let invokers = el._vei || (el._vei = {})
            // 获取key对应的处理函数
            let invoker = invokers[key]
            if (nextValue) {
                if (!invoker) {
                    // 如果之前没有invoker，就直接赋值
                    invoker = el._vei[key] = (e: EventTarget) => {
                        if (Array.isArray(invoker.value)) {
                            // @ts-ignore
                            invoker.value.forEach(fn => fn(e))
                        } else {
                            invoker.value(e)
                        }
                    }
                    // 将真正的事件处理函数赋值给invoker的value
                    invoker.value = nextValue
                    // 绑定事件
                    el.addEventListener(name, invoker)
                } else {
                    // 移出上一次绑定的时间处理函数
                    // DONE: 使用removeEventListener效率低下 考虑使用invoker包装事件
                    // 如果存在，就意味着更新，直接改invoker的value属性即可，不需要调用dom方法
                    // 性能更好
                    invoker.value = nextValue
                }
            } else if (invoker) {
                // 如果nextValue也没有了，说明是注销事件处理函数
                el.removeEventListener(name, invoker)
            }
            prevValue && el.removeEventListener(name, prevValue)
        }
        // 用 shouldSetAsProps 帮助函数确认 key 是否存在于对应的DOM Properties
        else if (key === "class") {
            el.className = nextValue || ''
        }else if (shouldSetAsProps(el, key, nextValue)) {
            const type = typeof el[key]
            // 如果类型是布尔 并且 值是空字符串，则设置为true
            if (type === "boolean" && nextValue === "") {
                el[key] = true
            } else {
                // 否则直接把value赋值给el对应的属性
                el[key] = nextValue
            }
        } else {
            // 如果没有对应的 DOM Properties（比如class -- className）
            // 使用setAttribute设置
            el.setAttribute(key, nextValue)
        }

    },
    unmount(vnode: vnode) {
        // 将unmount独立出来
        // 这里将来可以添加相关的生命周期函数
        if(!vnode.el) return
        const parent = vnode.el.parentNode
        if (parent) {
            removeCnt += 1
            parent.removeChild(vnode.el)
        }
    }
})


function propsTest() {
    const vnode = {
        type: "div",
        props: {
            id: 'foo'
        },
        key: '1',
        children: [
            {
                type: "p",
                children: "hello"
            }
        ]
    }
    helpTest(vnode)
}

function helpTest(vnode: vnode | null, id = "app") {
    effect(() => {
        renderer(vnode, document.getElementById(id))
    })
}

function classTest() {
    const vnode1 = {
        type: "p",
        key: '1',
        props: {
            class: "foo bar"
        },
    }

    const cls = {tee: true, pee: false}
    const vnode2 = {
        type: "p",
        key: '1',
        props: {
            class: normalizeClass(cls)
        }
    }

    const arr = [
        "gee yuu",
        { sww: true }
    ]
    const vnode3 = {
        type: "p",
        key: '1',
        props: {
            class: normalizeClass(arr)
        }
    }

    helpTest(vnode1)
    helpTest(vnode2, "app2")
    helpTest(vnode3, "app3")
}

function unmountTest() {
    const vnode1 = {
        type: "p",
        key: '1',
        children: "你应该看不到我才对"
    }

    helpTest(vnode1)
    helpTest(null)
}

function eventTest() {
    const vnode = {
        type: "button",
        key: '1',
        props: {
            onClick: [
                () => {
                    alert("world!")
                },
                () => {
                    alert("hello again!")
                }
            ]
        },
        children: "hello"
    }
    helpTest(vnode)
}

function baseTest() {
    const count = ref(1)
    effect(() => {
        const vnode = {
            type: "p",
            key: '1',
            children: `${count.value}`
        }
        helpTest(vnode)
    })
    count.value++
}

function simpleDiffTest() {
    const oldVnode = {
        type: 'div',
        key: 'oldVnode',
        children: [
            { type: 'p', children: '1', key: 1},
            { type: 'p', children: '2', key: 2},
            { type: 'p', children: 'hello', key: 3},
        ]
    }

    const newVnode = {
        type: 'div',
        key: 'newVnode',
        children: [
            { type: 'p', children: 'world', key: 3},
            { type: 'p', children: 'world', key: 4},
            { type: 'p', children: '2', key: 2},
        ]
    }

    // 挂载
    helpTest(oldVnode)
    setTimeout(() => {
        helpTest(newVnode)

        // 统计信息
        console.log(`共使用了${createCnt}次创建dom操作，${removeCnt}次删除dom操作, ${moveCnt}次移动操作`)
    }, 1000)
}

function componentTest() {
    const MyComponent = {
        name: 'MyComponent',
        props: {
            title: String
        },
        data() {
            return {
                foo: 1
            }
        },
        // @ts-ignore
        render() {
            return {
                type: 'div',
                // @ts-ignore
                children: `${this.title}  foo 的值是: ${this.foo}`
            }
        },
        created() {
            console.log('created')
        },
        beforeCreate() {
            console.log('beforeCreate')
        },
        beforeMount() {
            console.log('beforeMount')
        },
        mounted() {
            console.log('mounted')
        }

    }

    let vnode = {
        type: MyComponent,
        props: {
            title: 'A Bit Title'
        }
    }


    helpTest(vnode)

    vnode = {
        type: MyComponent,
        props: {
            title: 'A Small Title'
        }
    }

    helpTest(vnode)
}

function setupTest() {
    const MyComponent = {
        name: 'MyComponent',
        props: {
            title: String,
            onChange: Function
        },
        data() {
            return {
                foo: 1
            }
        },
        // @ts-ignore
        render() {
            return {
                type: 'div',
                // @ts-ignore
                children: `${this.title}  foo 的值是: ${this.foo} bar的值是：${this.bar}`
            }
        },
        setup(props: any, setupContext: any) {
            console.log(props.title)
            const {attrs, emit} = setupContext
            console.log(attrs)

            emit('change', 1, 2)
            return {
                bar: 2
            }
        }
    }

    const handler = (...args: any) => {
        console.log('onChange已触发，接收到的参数如下')
        for (let a in args) {
            console.log(a)
        }
    }

    const vnode = {
        type: MyComponent,
        props: {
            title: 'hello',
            foo: 1,
            onChange: handler
        }
    }

    helpTest(vnode)
}

;(function test() {
    setupTest()
    // componentTest()
    // simpleDiffTest()
    // baseTest()
    // propsTest()
    // classTest()
    // unmountTest()
    // eventTest()
})()


const count = ref(1)
count.value = 2

