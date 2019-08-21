import { PromiseStates, ResolveFunction, RejectFunction, ExecutorFunction, Nullable, Thennable, HandlerFunction } from './types/promiseTypes'

enum ReturnType {
  SUCCESS = 'success',
  ERROR = 'error'
}

export class TypePromise {
  private state: PromiseStates = PromiseStates.PENDING
  private finalFunction: Function = () => { }
  private value: any = null
  private thenHandlers: HandlerFunction[] = []

  constructor (executor: ExecutorFunction) {
    this.resolve = this.resolve.bind(this)
    this.reject = this.reject.bind(this)
    this.executeHandler = this.executeHandler.bind(this)
    this.doResolve(executor, this.resolve, this.reject)
  }

  private doResolve (resolverFn: ExecutorFunction, onFulfilled: ResolveFunction, onRejected: RejectFunction) {
    let done = false
    try {
      const handleValues = (type: ReturnType) => {
        return (value: any) => {
          if (done) return
          done = true
          return {
            error: onRejected,
            success: onFulfilled
          }[type](value)
        }
      }

      resolverFn(handleValues(ReturnType.SUCCESS), handleValues(ReturnType.ERROR))
    } catch (error) {
      if (done) return
      done = true
      onRejected(error)
    }
  }

  private resolve (result: any) {
    try {
      const then = this.getThen(result)
      if (then) return this.doResolve(then.bind(result), this.resolve, this.reject)
      this.fulfill(result)
    } catch (error) {
      this.reject(error)
    }
  }

  private fulfill (value: any) {
    this.state = PromiseStates.FULFILLED
    this.value = value
    this.thenHandlers.forEach(this.executeHandler)
    this.thenHandlers = []
    this.finalFunction()
  }

  private getThen (value: Thennable) {
    const t = typeof value
    if (value && (t === 'object' || t === 'function')) {
      const then = value.then
      if (typeof then === 'function') return then
    }
    return null
  }

  private reject (reason: any) {
    this.state = PromiseStates.REJECTED
    this.value = reason
    this.thenHandlers.forEach(this.executeHandler)
    this.thenHandlers = []
    this.finalFunction()
  }

  private executeHandler (handler: HandlerFunction) {
    if (this.state === PromiseStates.PENDING) return this.thenHandlers.push(handler)
    if (this.state === PromiseStates.FULFILLED && typeof handler.onFulfilled === 'function') return handler.onFulfilled(this.value)
    if (this.state === PromiseStates.REJECTED && typeof handler.onRejected === 'function') return handler.onRejected(this.value)
  }

  then (onFulfilled?: ResolveFunction, onRejected?: Nullable<RejectFunction>): TypePromise {
    return new TypePromise((resolve: ResolveFunction, reject: RejectFunction) => {
      const handleResult = (type: ReturnType) => {
        return (result: any) => {
          try {
            const executorFunction = type === ReturnType.ERROR ? reject : resolve
            const checkFunction = type === ReturnType.ERROR ? onRejected : onFulfilled
            return (typeof checkFunction === 'function') ? executorFunction(checkFunction(result)) : executorFunction(result)
          } catch (error) {
            reject(error)
          }
        }
      }

      return this.done(handleResult(ReturnType.SUCCESS), handleResult(ReturnType.ERROR))
    })
  }

  catch (onRejected: RejectFunction) {
    return new TypePromise((resolve: ResolveFunction, reject: RejectFunction) => {
      return this.done(resolve, (error: any) => {
        if (typeof onRejected === 'function') {
          try {
            return resolve(onRejected(error))
          } catch (error) {
            reject(error)
          }
        }
        return reject(error)
      })
    })
  }

  private done (onFulfilled?: ResolveFunction, onRejected?: Nullable<RejectFunction>) {
    setTimeout(() => {
      this.executeHandler({
        onFulfilled,
        onRejected
      })
    }, 0)
  }

  finally (finalFunction: Function) {
    if (typeof finalFunction === 'function') this.finalFunction = finalFunction
  }
}

/* EXAMPLE */





















function foo (param: any) {
  return new TypePromise((resolve, reject) => {
    if (Math.random() > 0.5) return setTimeout(resolve, 1000, param)
    return setTimeout(reject, 1000, 'error')
  })
}

(() => {
  foo(5)
    .then((value) => console.log(value))
    .catch((error) => console.error(error))
    .finally(() => console.log('sempre retorna'))
})()
