import { TypePromise } from './TypePromise'

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
    .finally(() => console.log('aways return'))
})()
