type Fn = () => any
// 用来存储副作用函数的容器
const bucket = new Set<Fn>()

// 响应式数据
const data = { text: "hello world!" }

const obj = new Proxy(data, {
    get(target: { text: string }, p: string | symbol, receiver: any): any {
        if (activeEffect) {
            bucket.add(activeEffect)
        }
        return target[p]
    },
    set(target: { text: string }, p: string | symbol, value: any, receiver: any): boolean {
        target[p] = value
        bucket.forEach(fn => {
            fn();
        })
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