type Fn = () => any
type DepsMap = Map<string | symbol, Set<Fn>>
// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
const bucket = new WeakMap<object, DepsMap>()

// 响应式数据
const data = { text: "hello world!" }

function track(target: object, key: string | symbol) {
    if (!activeEffect) {
        // 如果没有activeEffect，直接返回
        return
    }
    // 根据target从容器中取出 depsMap
    // depsMap 中根据对象属性索引副作用函数
    let depsMap = bucket.get(target)
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()))
    }
    // 由 p 取出depsMap中保存的副作用函数集合
    let deps = depsMap.get(key)
    // 如果deps不存在，就新建
    if (!deps) {
        depsMap.set(key, (deps = new Set()))
    }
    // 添加activeEffect到桶里
    deps.add(activeEffect)
}

function trigger(target: object, key: string | symbol) {
    // 取出depsMap
    const depsMap = bucket.get(target)
    if (!depsMap) return
    // 根据key取出相应的副作用函数们
    const effects = depsMap.get(key)
    // 短路
    effects && effects.forEach(fn => {
        fn();
    })
}


const obj = new Proxy(data, {
    get(target: object, p: string | symbol, receiver: any): any {
        track(target, p)
        // 返回p索引的值
        return target[p]
    },
    set(target: object, p: string | symbol, value: any, receiver: any): boolean {
        target[p] = value
        trigger(target, p)
        return true
    }
})

// 用全局变量存储注册的effect函数
let activeEffect
function effect(fn: Fn) {
    activeEffect = fn
    fn()
}

effect(
    () => {
        let node = document.querySelector("#app")
        node.textContent = obj.text
    }
)

setTimeout(() => {
    obj.text = "hello again!"
}, 1000)