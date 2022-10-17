interface EffectFunction {
    (): any
    deps: DepsSet[]
    options: EffectOptions
}
type Fn = () => any
type DepsSet = Set<EffectFunction>
type DepsMap = Map<string | symbol, DepsSet>
type SchedulerFunction = (fn: EffectFunction) => any
type WatchCallBackFunction = (newValue?: any, oldValue?: any) => any
type EffectOptions = {
    scheduler?: SchedulerFunction
    lazy?: boolean
}
type SetType = "SET" | "ADD" | "DELETE"