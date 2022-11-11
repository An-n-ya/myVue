export { ref, effect, reactive, shallowReactive };
// interface EffectFunction {
//     (): any
//     deps: DepsSet[]
//     options: EffectOptions
// }
// type Fn = () => any
// type DepsSet = Set<EffectFunction>
// type DepsMap = Map<string | symbol, DepsSet>
// type SchedulerFunction = (fn: EffectFunction) => any
// type WatchCallBackFunction = (newValue?: any, oldValue?: any) => any
// type EffectOptions = {
//     scheduler?: SchedulerFunction
//     lazy?: boolean
// }
// type SetType = "SET" | "ADD" | "DELETE"
const ITERATE_KEY = Symbol();
function getType(obj) {
    // @ts-ignore
    const type = Object.prototype.toString.call(obj).match(/^\[object (.*)\]$/)[1].toLowerCase();
    if (type === 'string' && typeof obj === 'object')
        return 'object'; // Let "new String('')" return 'object'
    if (obj === null)
        return 'null'; // PhantomJS has type "DOMWindow" for null
    if (obj === undefined)
        return 'undefined'; // PhantomJS has type "DOMWindow" for undefined
    return type;
}
// 用来存储副作用函数的容器
// 使用weakMap作用容器
// 这里使用weakMap的原因是，在被代理对象引用失效后，不持续引用， 方便垃圾回收
const bucket = new WeakMap();
// 用全局变量存储注册的effect函数
let activeEffect;
// 使用一个栈存放effect函数
const effectStack = [];
function track(target, key) {
    if (!activeEffect || !shouldTrack) {
        // 如果禁止跟踪，直接返回
        // 如果没有activeEffect，直接返回
        return;
    }
    // 根据target从容器中取出 depsMap
    // depsMap 中根据对象属性索引副作用函数
    let depsMap = bucket.get(target);
    if (!depsMap) {
        bucket.set(target, (depsMap = new Map()));
    }
    // 由 p 取出depsMap中保存的副作用函数集合
    let deps = depsMap.get(key);
    // 如果deps不存在，就新建
    if (!deps) {
        depsMap.set(key, (deps = new Set()));
    }
    // 添加activeEffect到桶里
    deps.add(activeEffect);
    // 这里的deps就是与当前副作用函数存在联系的依赖集合
    // 将deps添加到 activeEffect.deps 中去
    activeEffect.deps.push(deps);
}
function trigger(target, key, type) {
    // 取出depsMap
    const depsMap = bucket.get(target);
    if (!depsMap)
        return;
    // 根据key取出相应的副作用函数们
    const effects = depsMap.get(key);
    // 取得与 ITERATE_KEY 相关的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 在临时容器中执行 防止无限循环
    const effectsToRun = new Set();
    // 与 key 相关的副作用添加到effectToRun
    effects && effects.forEach(effectFn => {
        // 如果trigger触发执行的副作用函数与当前正在执行的副作用函数相同，就不执行了, 防止栈溢出
        if (effectFn != activeEffect) {
            effectsToRun.add(effectFn);
        }
    });
    // 只有在"添加" 或 "删除" 时，才触发ITERATE_KEY相关的副作用
    if (type === "ADD" || type === "DELETE") {
        // 与 ITERATE_KEY 相关的副作用添加到effectToRun
        iterateEffects && iterateEffects.forEach(effectFn => {
            if (effectFn != activeEffect) {
                effectsToRun.add(effectFn);
            }
        });
    }
    // 在添加时，如果目标对象是数组，就执行与length相关的副作用。（原因是，js引擎在修改数组的时候会访问length属性，从而建立依赖）
    if (type === "ADD" && Array.isArray(target)) {
        const lengthEffect = depsMap.get("length");
        // 将lengthEffect都加入effectsToRun
        lengthEffect && lengthEffect.forEach(effectFn => {
            if (effectFn != activeEffect) {
                effectsToRun.add(effectFn);
            }
        });
    }
    effectsToRun && effectsToRun.forEach(effectFn => {
        if (effectFn.options.scheduler) {
            // 如果有调度函数
            // 把effectFn控制权交给定义调度函数的用户
            effectFn.options.scheduler(effectFn);
        }
        else {
            effectFn();
        }
    });
}
// 第二个参数代表是否浅响应
// 第三个参数代表是否只读（如果只读，就不会建立响应了）
function createReactive(obj, isShallow = false, isReadOnly = false) {
    return new Proxy(obj, {
        get(target, p, receiver) {
            // target的__raw是框架使用的属性，用来返回原始数据
            if (p === "__raw") {
                return target;
            }
            // 如果是数组，并且访问的是已经被重写的方法，直接返回
            if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(p)) {
                return Reflect.get(arrayInstrumentations, p, receiver);
            }
            if (getType(target) == 'map') {
                if (p == 'size') {
                    track(target, ITERATE_KEY);
                    return Reflect.get(target, p, target);
                }
                return target[p].bind(target);
            }
            // 返回p索引的值
            // 使用Reflect.get把receiver传递进去，使target里的this指向代理对象，从而方便建立响应
            const res = Reflect.get(target, p, receiver);
            if (isShallow) {
                // 如果是浅响应，直接返回
                return res;
            }
            if (!isReadOnly && typeof p !== 'symbol') {
                // 只对非只读和非symbol的属性跟踪
                track(target, p);
            }
            if (typeof res === "object" && res !== null) {
                // if (res.__v_isRef) {
                //     // 如果是ref对象，脱钩ref
                //     return res.value
                // }
                // 如果res是对象，就继续调用reactive，使得对象的深层结构也响应
                // 如果数据只读，对象的所有属性也是只读
                return isReadOnly ? readonly(res) : reactive(res);
            }
            return res;
        },
        set(target, p, value, receiver) {
            if (isReadOnly) {
                // 如果是只读，拒绝修改，直接返回
                console.warn(`属性${String(p)}是只读的`);
                return true;
            }
            // 先获取旧值
            const oldVal = target[p];
            // 用来区分是添加还是修改，方便trigger区分
            const type = Array.isArray(target)
                // 判断代理目标是否是数组
                // 再根据对应的标准判断是添加还是修改
                ? Number(p) < target.length ? "SET" : "ADD"
                : Object.prototype.hasOwnProperty.call(target, p) ? "SET" : "ADD";
            // if (target.__v_isRef) {
            //     // 如果是ref对象
            //     // 先取出来
            //     const vv = target[p]
            //     // 再赋值
            //     vv.value = value
            //     return true
            // }
            // Reflect代替直接赋值
            const res = Reflect.set(target, p, value, receiver);
            // 只有在receiver是target的代理对象时，才触发trigger
            // 这个条件是为了防止在原型链上查找时，触发trigger
            if (target === receiver["__raw"]) {
                // 比较新值和旧值，只有在不相同时才触发trigger(同时需要处理NaN)
                if (target !== value && (oldVal === oldVal || value === value)) {
                    trigger(target, p, type);
                }
            }
            return res;
        },
        // 代理 key in obj
        has(target, p) {
            // 建立依赖追踪
            track(target, p);
            return Reflect.has(target, p);
        },
        // 代理 for ... in
        ownKeys(target) {
            // 建立target 与 ITERATE_KEY的依赖
            // 如果是数组的话，用length建立响应联系
            track(target, Array.isArray(target) ? "length" : ITERATE_KEY);
            return Reflect.ownKeys(target);
        },
        // 代理 for ... of
        // 代理删除 delete
        deleteProperty(target, p) {
            if (isReadOnly) {
                // 如果是只读，拒绝删除，直接返回
                console.warn(`属性${String(p)}是只读的`);
                return true;
            }
            const hadKey = Object.prototype.hasOwnProperty.call(target, p);
            const res = Reflect.deleteProperty(target, p);
            // 只有在删除成功时，才触发trigger
            if (hadKey && res) {
                trigger(target, p, "DELETE");
            }
            return res;
        },
    });
}
// 建立原始值和代理对象之间的map
const reactiveMap = new Map();
function reactive(obj) {
    // 如果reactiveMap里已经有了，就直接返回
    const existProxy = reactiveMap.get(obj);
    if (existProxy)
        return existProxy;
    // 否则创建新的
    const proxy = createReactive(obj);
    // 再存到map中
    // 要用set方法设置，不要直接用[]表达式设置
    reactiveMap.set(obj, proxy);
    return proxy;
}
function shallowReactive(obj) {
    return createReactive(obj, true);
}
function readonly(obj) {
    return createReactive(obj, false, true);
}
function shallowReadonly(obj) {
    return createReactive(obj, true, true);
}
function cleanup(effectFn) {
    for (let i = 0; i < effectFn.deps.length; i++) {
        // 将effectFn从它的依赖集合中删除
        const deps = effectFn.deps[i];
        deps.delete(effectFn);
    }
    effectFn.deps.length = 0;
}
// 实现watch
function watch(source, cb) {
    // 用来支持为函数的source
    let getter;
    if (typeof source == 'function') {
        getter = source;
    }
    else {
        getter = () => traverse(source);
    }
    // 定义旧值和新值
    let oldValue, newValue;
    const effectFn = effect(
    // 调用traverse函数递归读取source
    () => getter(), {
        lazy: true,
        scheduler() {
            // 在 scheduler 中重新执行副作用函数，得到的是新值
            newValue = effectFn();
            // 调用回调函数
            cb(newValue, oldValue);
            // 更新旧值
            oldValue = newValue;
        }
    });
    // 手动调用副作用函数，拿到旧值
    oldValue = effectFn();
}
function traverse(value, seen = new Set()) {
    // *终止条件* 如果要读取的数据不是对象，或者已经被读取了
    if (typeof value != 'object' || value === null || seen.has(value))
        return;
    // 将数据加入seen
    seen.add(value);
    for (const k in value) {
        traverse(value[k], seen);
    }
    return value;
}
// 实现computed  计算属性
function computed(getter) {
    // value 用来缓存上一次计算的值
    let value;
    // 用来标识是否需要重新计算
    let dirty = true;
    // 把 getter 作为副作用函数，创建一个lazy的effect
    const effectFn = effect(getter, { lazy: true, scheduler() {
            // 在改变的时候重置dirty
            dirty = true;
            // 当计算属性依赖的响应式数据变化时，手动调用trigger
            trigger(obj, 'value', 'SET');
        } });
    const obj = {
        get value() {
            // 只有在dirty状态下需要重新计算
            if (dirty) {
                // 在读取value时，调用effectFn
                value = effectFn();
                dirty = false;
            }
            // 当读取value时，手动调用track函数跟踪依赖
            track(obj, 'value');
            return value;
        }
    };
    return obj;
}
function effect(fn, options = {}) {
    const effectFn = () => {
        // 当effectFn执行时， 将其设置为activeEffect
        cleanup(effectFn);
        activeEffect = effectFn;
        // 在调用副作用函数之前，把activeEffect入栈
        effectStack.push(activeEffect);
        // 把结果保存下来返回
        const res = fn();
        // 副作用函数执行完后，弹出
        effectStack.pop();
        // 还原activeEffect
        activeEffect = effectStack[effectStack.length - 1];
        return res;
    };
    // 将options添加到effectFn上
    effectFn.options = options;
    // activeEffect.deps 用来存放与该副作用函数相关联的依赖
    // 依赖在track函数中收集
    effectFn.deps = [];
    // 只有在非lazy是运行
    if (!options.lazy) {
        effectFn();
    }
    return effectFn;
}
function toRefs(obj) {
    const ret = [];
    for (const key in obj) {
        // @ts-ignore
        ret[key] = toRef(obj, key);
    }
    return ret;
}
function toRef(obj, key) {
    const wrapper = {
        get value() {
            return obj[key];
        },
        set value(val) {
            obj[key] = val;
        }
    };
    // 定义 __v_isRef 属性
    Object.defineProperty(wrapper, "__v_isRef", { value: true });
    return wrapper;
}
function proxyRefs(target) {
    return new Proxy(target, {
        get(target, key, receiver) {
            const value = Reflect.get(target, key, receiver);
            console.log(value);
            console.log(target);
            // 判断是否是ref属性，从而实现ref脱钩
            return value.__v_isRef ? value.value : value;
        },
        set(target, key, newValue, receiver) {
            const value = target[key];
            if (value.__v_isRef) {
                value.value = newValue;
                return true;
            }
            return Reflect.set(target, key, newValue, receiver);
        }
    });
}
function ref(val) {
    // 把原始值包裹
    // 然后再进行代理
    const wrapper = { value: val };
    // 用来区分一个数据是否是ref
    Object.defineProperty(wrapper, "__v_isRef", { value: true });
    return reactive(wrapper);
}
// 重写array的方法
const arrayInstrumentations = {
    __raw: undefined,
    includes: function () {
    }
};
["includes", "indexOf", "lastIndexOf"].forEach(method => {
    // 获取原始方法
    // @ts-ignore
    const originMethod = Array.prototype[method];
    // @ts-ignore
    arrayInstrumentations[method] = function (...args) {
        // 先获取原始方法的返回值
        let res = originMethod.apply(this, args);
        // 如果没找到, 就用原始值找找看
        if (res == false) {
            res = originMethod.apply(this.__raw, args);
        }
        return res;
    };
});
// 用一个变量表示是否允许跟踪，默认值为true
let shouldTrack = true;
["push", "pop", "shift", "unshift", "splice"].forEach((method) => {
    // 获取原始方法
    // @ts-ignore
    const originMethod = Array.prototype[method];
    // @ts-ignore
    arrayInstrumentations[method] = function (...args) {
        // 在调用原始方法前，先禁止跟踪
        shouldTrack = false;
        let res = originMethod.apply(this, args);
        shouldTrack = true;
        return res;
    };
});
// 响应式数据
const data = { ok: true, text: "hello world!", val: 1, foo: 2 };
const obj = reactive(data);
(function test() {
    // test_basic()
    // test_branch()
    // test_recursion()
    // test_stackoverflow()
    // test_scheduler()
    // test_lazy()
    // test_computed()
    // test_computed_with_recursion()
    // test_watch()
    // test_reactive()
    // test_array()
    // test_map()
    // test_ref()
    // test_reactive_lost()
})();
// 处理响应丢失
function test_reactive_lost() {
    const obj = reactive({ foo: 1, bar: 2 });
    const newObj = proxyRefs(Object.assign({}, toRefs(obj)));
    effect(() => {
        console.log(newObj.foo);
    });
    obj.foo = 100;
}
// 测试原始值的响应
function test_ref() {
    const refV = ref(1);
    effect(() => {
        console.log(refV.value);
    });
    refV.value = 2;
    // const obj = reactive({refV})
    // effect(() => {
    //     // reactive的脱钩
    //     console.log(obj.refV)
    // })
    //
    // obj.refV = 2
}
// 测试map
function test_map() {
    const proxy = reactive(new Map([['key', 1]]));
    effect(() => {
        console.log(proxy.get("key"));
    });
    proxy.set('key', 2);
}
// 测试数组
function test_array() {
    const data = [1];
    const obj = reactive(data);
    effect(() => {
        console.log(obj.length);
    });
    obj[1] = 2;
    // 代理for ... of
    const data2 = [1, 2, 3, 4, 5];
    const obj2 = reactive(data2);
    effect(() => {
        for (const i of obj2) {
            console.log(i);
        }
    });
    obj2[2] = 100;
    // 测试includes
    const o = {};
    const obj3 = reactive([o]);
    console.log(obj3.includes(o));
    console.log(obj3.includes(obj3[0]));
    // 测试push (问题：防止栈溢出)
    const arr = reactive([]);
    effect(() => arr.push(1));
    effect(() => arr.push(2));
}
// 测试深浅响应 与 只读
function test_reactive() {
    const data = { foo: { bar: 1 } };
    const obj = reactive(data);
    effect(() => {
        console.log(obj.foo.bar + "改变啦！");
    });
    obj.foo.bar++;
    const shallowObj = shallowReactive(data);
    effect(() => {
        console.log(shallowObj.foo.bar + "shallowObj你应该只看到我一次");
    });
    shallowObj.foo.bar++;
    const readonlyObj = readonly(data);
    effect(() => {
        console.log(readonlyObj.foo.bar + "readonlyObj你应该只看到我一次");
    });
    readonlyObj.foo.bar = 100;
}
// 测试watch
function test_watch() {
    watch(obj, () => {
        console.log("obj变啦！");
    });
    obj.val++;
    // watch也可以处理函数
    watch(() => obj.foo, () => console.log("obj.foo变啦！"));
    // 下面这个会同时触发两个watch
    obj.foo++;
    // 这个只会触发一个
    obj.val++;
    watch(() => obj.val, (nv, ov) => {
        console.log(`新值是${nv}, 旧值是${ov}`);
    });
    obj.val++;
}
// 测试涉及嵌套的计算函数
function test_computed_with_recursion() {
    const res = computed(() => {
        console.log("缓存结果，只有在值改变的时候你能看到我");
        return obj.val + obj.foo;
    });
    effect(() => {
        console.log(res.value);
    });
    // 应该会触发上面的effect，输出4
    obj.val++;
}
// 测试计算函数
function test_computed() {
    const res = computed(() => {
        console.log("缓存结果，只有在值改变的时候你能看到我");
        return obj.val + obj.foo;
    });
    console.log(res.value);
    console.log(res.value);
    console.log(res.value);
    obj.val++;
    console.log(res.value);
}
// 测试lazy
function test_lazy() {
    const effectFn = effect(() => {
        console.log(obj.val);
    }, {
        lazy: true
    });
    // 这是已经不能执行副作用函数了
    obj.val++;
    // 需要手动调用
    effectFn();
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
    console.log("=====after=====");
    effect(() => {
        console.log(obj.val);
    }, {
        scheduler(fn) {
            // 将fn放到宏任务执行
            setTimeout(fn);
        }
    });
    obj.val++;
    console.log("over");
    console.log("===============");
}
// 避免无线递归，栈溢出
function test_stackoverflow() {
    effect(() => {
        // 下面这个操作既有读 又有写，会导致无限递归
        obj.val++;
    });
    console.log(obj.val);
}
// 嵌套测试
function test_recursion() {
    let tmp1, tmp2;
    effect(() => {
        console.log("外层执行");
        effect(() => {
            console.log("内层执行");
            tmp2 = obj.ok;
        });
        tmp1 = obj.text;
    });
    // 理想情况应该是：
    // 外层执行
    // 内层执行
    // 外层执行
    // 内层执行
    obj.text = "haha";
}
// 分支测试
function test_branch() {
    effect(() => {
        console.log("你应该只看到我两次！");
        let node = document.querySelector("#app");
        // @ts-ignore
        node.textContent = obj.ok ? obj.text : 'not';
    });
    // 切换成false之后， text上的副作用函数应该取消监听
    obj.ok = false;
    // 改变这个将不会触发副作用函数
    obj.text = "hello";
}
// 基础测试
function test_basic() {
    effect(() => {
        let node = document.querySelector("#app");
        // @ts-ignore
        node.textContent = "hello world!";
    });
    setTimeout(() => {
        obj.text = "hello again!";
    }, 1000);
}
