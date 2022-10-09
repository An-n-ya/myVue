interface EffectFunction {
    (): any
    deps: DepsSet[]
}
type Fn = () => any
type DepsSet = Set<EffectFunction>
type DepsMap = Map<string | symbol, DepsSet>

// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
const bucket = new WeakMap<object, DepsMap>()
// 用全局变量存储注册的effect函数
let activeEffect: EffectFunction

// 响应式数据
const data = { ok: true, text: "hello world!" }

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

    // 这里的deps就是与当前副作用函数存在联系的依赖集合
    // 将deps添加到 activeEffect.deps 中去
    activeEffect.deps.push(deps)
}

function trigger(target: object, key: string | symbol) {
    // 取出depsMap
    const depsMap = bucket.get(target)
    if (!depsMap) return
    // 根据key取出相应的副作用函数们
    const effects = depsMap.get(key)

    // 在临时容器中执行 防止无线循环
    const effectsToRun = new Set<EffectFunction>(effects)
    effectsToRun && effectsToRun.forEach(effectFn => effectFn())
}


const obj = new Proxy(data, {
    get(target: any, p: string | symbol, receiver: any): any {
        track(target, p)
        // 返回p索引的值
        return target[p]
    },
    set(target: any, p: string | symbol, value: any, receiver: any): boolean {
        target[p] = value
        trigger(target, p)
        return true
    }
})

function cleanup(effectFn: EffectFunction) {
    for (let i = 0; i < effectFn.deps.length; i ++) {
        // 将effectFn从它的依赖集合中删除
        const deps = effectFn.deps[i]
        deps.delete(effectFn)
    }
    effectFn.deps.length = 0
}

function effect(fn: Fn) {
    const effectFn = () => {
        // 当effectFn执行时， 将其设置为activeEffect
        cleanup(effectFn)
        activeEffect = effectFn
        fn()
    }

    // activeEffect.deps 用来存放与该副作用函数相关联的依赖
    // 依赖在track函数中收集
    effectFn.deps = []
    effectFn()
}

effect(
    () => {
        console.log("你应该只看到我两次！")
        let node = document.querySelector("#app")
        node.textContent = obj.ok ? obj.text : 'not'
    }
)

// 切换成false之后， text上的副作用函数应该取消监听
obj.ok = false

obj.text = "hello"

// setTimeout(() => {
//     obj.text = "hello again!"
// }, 1000)