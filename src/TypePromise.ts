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

  private getHandlerType (type: ReturnType, done: boolean, onFulfilled: ResolveFunction, onRejected: RejectFunction) {
    return (value: any) => {
      if (done) return
      done = true
      return { error: onRejected, success: onFulfilled }[type](value)
    }
  }

  /**
   * Takes a potentially problematic resolver function and make sure the resolvers for onFulfilled and onRejected are only called once.
   * @param resolverFn {Function} resolverFn A resolver function which is not trusted
   * @param onFulfilled {Function} onFulfilled The function to be called when fulfilled
   * @param onRejected {Function} onRejected The function to be called when rejected
   */
  private doResolve (resolverFn: ExecutorFunction, onFulfilled: ResolveFunction, onRejected: RejectFunction) {
    let done = false
    try {
      resolverFn(this.getHandlerType(ReturnType.SUCCESS, done, onFulfilled, onRejected), this.getHandlerType(ReturnType.ERROR, done, onFulfilled, onRejected))
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
    this.executeAllHandlers()
    this.finalFunction()
  }

  /**
   * Check if a value is a Promise, if it is, extract the `then` method and return
   */
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
    this.executeAllHandlers()
    this.finalFunction()
  }

  private executeAllHandlers () {
    this.thenHandlers.forEach(this.executeHandler)
    this.thenHandlers = []
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
    process.nextTick(() => {
      this.executeHandler({
        onFulfilled,
        onRejected
      })
    })
  }

  finally (finalFunction: Function) {
    if (typeof finalFunction === 'function') this.finalFunction = finalFunction
  }
}
