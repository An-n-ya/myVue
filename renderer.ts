import {ref, effect} from "./reactivity.js"

function renderer(domString: any, container: any) {
    container.innerHTML = domString
}

const count = ref(1)

effect(() => {
    renderer(`<h1>${count.value}</h1>`, document.getElementById("app"))
})

count.value = 2

