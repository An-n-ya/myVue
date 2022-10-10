interface EffectFunction {
    (): any
    deps: DepsSet[]
    options: EffectOptions
}
type Fn = () => any
type DepsSet = Set<EffectFunction>
type DepsMap = Map<string | symbol, DepsSet>
type SchedulerFunction = (EffectFunction) => any
type EffectOptions = {
    scheduler?: SchedulerFunction
    lazy?: boolean
}

// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
const bucket = new WeakMap<object, DepsMap>()
// 用全局变量存储注册的effect函数
let activeEffect: EffectFunction
// 使用一个栈存放effect函数
const effectStack: EffectFunction[] = []

// 响应式数据
const data = { ok: true, text: "hello world!", val: 1, foo: 2 }

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
    const effectsToRun = new Set<EffectFunction>()
    effects && effects.forEach(effectFn => {
        // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，就不执行了, 防止栈溢出
        if (effectFn != activeEffect) {
            effectsToRun.add(effectFn)
        }
    })
    effectsToRun && effectsToRun.forEach(effectFn => {
        if (effectFn.options.scheduler) {
            // 如果有调度函数
            // 把effectFn控制权交给定义调度函数的用户
            effectFn.options.scheduler(effectFn)
        }else {
            effectFn()
        }
    })
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

// 实现computed  计算属性
function computed(getter: Fn) {
    // value 用来缓存上一次计算的值
    let value
    // 用来标识是否需要重新计算
    let dirty = true
    // 把 getter 作为副作用函数，创建一个lazy的effect
    const effectFn = effect(getter, {lazy: true, scheduler() {
            // 在改变的时候重置dirty
            dirty = true
            // 当计算属性依赖的响应式数据变化时，手动调用trigger
            trigger(obj, 'value')
        }})
    const obj = {
        get value() {
            // 只有在dirty状态下需要重新计算
            if (dirty) {
                // 在读取value时，调用effectFn
                value = effectFn()
                dirty = false
            }
            // 当读取value时，手动调用track函数跟踪依赖
            track(obj, 'value')
            return value
        }
    }
    return obj
}


function effect(fn: Fn, options: EffectOptions = {}) {
    const effectFn = () => {
        // 当effectFn执行时， 将其设置为activeEffect
        cleanup(effectFn)
        activeEffect = effectFn
        // 在调用副作用函数之前，把activeEffect入栈
        effectStack.push(activeEffect)
        // 把结果保存下来返回
        const res = fn()
        // 副作用函数执行完后，弹出
        effectStack.pop()
        // 还原activeEffect
        activeEffect = effectStack[effectStack.length - 1]
        return res
    }
    // 将options添加到effectFn上
    effectFn.options = options

    // activeEffect.deps 用来存放与该副作用函数相关联的依赖
    // 依赖在track函数中收集
    effectFn.deps = []
    // 只有在非lazy是运行
    if (!options.lazy) {
        effectFn()
    }
    return effectFn
}

function test() {
    // test_basic()
    // test_branch()
    // test_recursion()
    // test_stackoverflow()
    // test_scheduler()
    // test_lazy()
    // test_computed()
    test_computed_with_recursion()
}

// 测试涉及嵌套的计算函数
function test_computed_with_recursion() {
    const res = computed(() => {
        console.log("缓存结果，只有在值改变的时候你能看到我")
        return obj.val + obj.foo
    })
    effect(() => {
        console.log(res.value)
    })
    // 应该会触发上面的effect，输出4
    obj.val++
}

// 测试计算函数
function test_computed() {
    const res = computed(() => {
        console.log("缓存结果，只有在值改变的时候你能看到我")
        return obj.val + obj.foo
    })
    console.log(res.value)
    console.log(res.value)
    console.log(res.value)
    obj.val++
    console.log(res.value)
}

// 测试lazy
function test_lazy() {
    const effectFn = effect(() => {
        console.log(obj.val)},{
        lazy: true
    })
    // 这是已经不能执行副作用函数了
    obj.val++
    // 需要手动调用
    effectFn()
}


// 测试调度执行
function test_scheduler() {
    // console.log("=====before=====")
    // effect(() => {
    //     console.log(obj.val)
    // })
    // obj.val++
    // console.log("over")
    // console.log("===============")
    console.log("=====after=====")
    effect(() => {
        console.log(obj.val)
    }, {
        scheduler(fn){
            // 将fn放到宏任务执行
            setTimeout(fn)
        }
        })
    obj.val++
    console.log("over")
    console.log("===============")

}

// 避免无线递归，栈溢出
function test_stackoverflow() {
    effect(() => {
        // 下面这个操作既有读 又有写，会导致无限递归
        obj.val ++
    })
    console.log(obj.val)
}

// 嵌套测试
function test_recursion() {
    let tmp1, tmp2
    effect(
        () => {
            console.log("外层执行")

            effect(() => {
                console.log("内层执行")
                tmp2 = obj.ok
            })

            tmp1 = obj.text
        }
    )
    // 理想情况应该是：
    // 外层执行
    // 内层执行
    // 外层执行
    // 内层执行
    obj.text = "haha"
}

// 分支测试
function test_branch() {
    effect(
        () => {
            console.log("你应该只看到我两次！")
            let node = document.querySelector("#app")
            node.textContent = obj.ok ? obj.text : 'not'
        }
    )

// 切换成false之后， text上的副作用函数应该取消监听
    obj.ok = false

// 改变这个将不会触发副作用函数
    obj.text = "hello"
}

// 基础测试
function test_basic() {
    effect(
        () => {
            let node = document.querySelector("#app")
            node.textContent = "hello world!"
        }
    )

    setTimeout(() => {
        obj.text = "hello again!"
    }, 1000)
}

test()
