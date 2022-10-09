type Fn = () => any
const bucket = new Set<Fn>()

const data = { text: "hello world!" }

const obj = new Proxy(data, {
    get(target: { text: string }, p: string | symbol, receiver: any): any {
        bucket.add(effect)
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

function effect() {
    let node = document.querySelector("#app")
    node.textContent = obj.text
}

effect()

setTimeout(() => {
    obj.text = "hello again!"
}, 1000)