<script>
  import { createEventDispatcher } from 'svelte'
  import store from '../utils/store.js'

  const dispatch = createEventDispatcher()

  let orders = []

  store.subscribe(items => {
    orders = items
  })

  const currencyFormat = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  })

  $: total = orders.reduce((prev, next) => {
    prev += (Number(next.price) * next.count)
    return prev
  }, 0)

  function edit(id, order, price, count) {
    dispatch('edit', {id, order, price, count})
  }

  function remove(id) {
    // 如果传参进来evenet那么event.stopPropagation()
    // 或者在标签页直接像现在这样用svelte语法，直接在便签中添加stopPropagation
    store.remove(id)
  }

  function minus(id, count) {
    if (count > 1) {
      count -= 1
      store.changeCount(id, count)
    }
  }

  function add(id, count) {
    count += 1
    store.changeCount(id, count)
  }
</script>

<style>
  table {
    width: 100%;
  }
  .button-box {
    display: flex;
  } 
  .two {
    /* width: 2rem; */
    text-align: center;
    margin: 0 1rem;
    /* display: inline-block; */
    vertical-align: middle;
  }
  .count-input {
    width: 10rem;
    margin-bottom: 0;
    /* display: inline-block; */
    vertical-align: middle;
  }
  .order {
    cursor: pointer;
  }
</style>

<table class="primary">
  <thead>
    <tr>
      <th>Item</th>
      <th>Price</th>
      <th>Count</th>
      <th />
    </tr>
  </thead>
  <tbody>
    {#each orders as order (order.id)}
    <tr class="order" on:click={edit(order.id, order.order, order.price, order.count)}>
      <td>{order.order}</td>
      <td>{currencyFormat.format(order.price)}</td>
      <td class="button-box">
        <div
          class="two columns"
          on:click|stopPropagation={minus(order.id, order.count)}
          type="button"
        >
          -
      </div>
        <input
          bind:value={order.count}
          class="count-input"
          min="1"
          step="any"
          type="text"
          name="count"
        >
        <div
          class="two columns"
          on:click|stopPropagation={add(order.id, order.count)}
          type="button"
        >
          +
        </div>
      </td>
      <td>
        <i
          class="far fa-trash-alt"
          on:click|stopPropagation={remove(order.id)}
        />
      </td>
    </tr>
    {/each}
    <tr>
      <td>Total</td>
      <td colspan="3">{currencyFormat.format(total)}</td>
    </tr>
  </tbody>
</table>
