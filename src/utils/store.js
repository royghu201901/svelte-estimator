import {writable} from 'svelte/store'

const store = writable([])
const key = 'order'

if (localStorage.getItem(key)) {
  store.set(JSON.parse(
    localStorage.getItem(key)
  ))
}

const add = (order, price) => {
  store.update((items) => {
    const item = {
      order,
      price,
      id: new Date().getTime()
    }
    return [item, ...items]
  })
}

const edit = (id, order, price) => {
  store.update((items) => {
    const index = items.findIndex((i) => i.id === id)
    items[index].order = order
    items[index].price = price
    return items
  })
}

store.subscribe((items) => {
  const jsonString = JSON.stringify(items)
  localStorage.setItem(key, jsonString)
})

export default {
  subscribe: store.subscribe,
  add,
  edit
}