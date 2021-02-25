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
    prev += Number(next.price)
    return prev
  }, 0)

  function edit(id, order, price) {
    dispatch('edit', {id, order, price})
  }
</script>

<style>
  table {
    width: 100%;
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
      <th />
    </tr>
  </thead>
  <tbody>
    {#each orders as order (order.id)}
    <tr class="order" on:click={edit(order.id, order.order, order.price)}>
      <td>{order.order}</td>
      <td>{currencyFormat.format(order.price)}</td>
      <td>
        <i class="far fa-trash-alt" />
      </td>
    </tr>
    {/each}
    <tr>
      <td>Total</td>
      <td colspan="2">{currencyFormat.format(total)}</td>
    </tr>
  </tbody>
</table>